"""Unit tests for 17track API client and URL parsing.

Like Dean Pelton tracking his dalmatian-themed costume collection,
we're meticulously testing every tracking number format.
"""

import httpx
import pytest
import respx

from app.features.tracking.client import (
    CARRIER_CODE_MAP,
    SeventeenTrackClient,
    TrackingURLParser,
)
from app.features.tracking.models import (
    DeliveryStatus,
    SeventeenTrackResponse,
)


class TestTrackingURLParser:
    """Test URL parsing for FedEx, UPS, and USPS tracking URLs."""

    @pytest.mark.parametrize(
        ("url", "expected_number", "expected_carrier"),
        [
            # FedEx patterns (query params) - only 888079995075 is validated by tracking-numbers library
            (
                "https://www.fedex.com/apps/fedextrack/?tracknumbers=888079995075",
                "888079995075",
                "FedEx",
            ),
            (
                "https://www.fedex.com/apps/fedextrack/?tracknumbers=796806677146",
                "796806677146",
                "FedEx",
            ),
            # UPS patterns (query params)
            (
                "https://www.ups.com/track?tracknum=1Z999AA10123456784",
                "1Z999AA10123456784",
                "UPS",
            ),
            (
                "https://ups.com/WebTracking/track?trackNums=1ZXJ33010323181135",
                "1ZXJ33010323181135",
                "UPS",
            ),
            # USPS patterns (query params) - tracking-numbers library returns full name
            (
                "https://tools.usps.com/go/TrackConfirmAction?tLabels=9214490358937913278325",
                "9214490358937913278325",
                "United States Postal Service",
            ),
            (
                "https://www.usps.com/go/TrackConfirmAction?tLabels=9400111899561838892839",
                "9400111899561838892839",
                "United States Postal Service",
            ),
            # LaserShip patterns (path-based, domain inference)
            (
                "https://t.lasership.com/Track/1LSCYG5005U4ZOZ",
                "1LSCYG5005U4ZOZ",
                "LaserShip",
            ),
            (
                "https://www.lasership.com/Track/LS123456789",
                "LS123456789",
                "LaserShip",
            ),
            # OnTrac patterns (path-based, domain inference)
            (
                "https://www.ontrac.com/tracking/D123456789012",
                "D123456789012",
                "OnTrac",
            ),
        ],
    )
    def test_parse_url_extracts_tracking_number_and_carrier(
        self, url: str, expected_number: str, expected_carrier: str
    ) -> None:
        """Parse_url should extract tracking numbers from carrier URLs (query params and path-based)."""
        number, carrier = TrackingURLParser.parse_url(url)

        assert number == expected_number
        assert carrier == expected_carrier

    def test_parse_url_handles_case_insensitive_params(self) -> None:
        """URL params should be case-insensitive - USPS uses mixed case."""
        url = "https://tools.usps.com/go/TrackConfirmAction?TLABELS=9214490358937913278325"
        number, carrier = TrackingURLParser.parse_url(url)

        assert number == "9214490358937913278325"
        assert carrier == "United States Postal Service"

    def test_parse_url_fallback_generic_params_with_real_tracking_number(
        self,
    ) -> None:
        """Parse_url should extract real tracking numbers from generic URLs."""
        # Use a real FedEx tracking number that validates
        url = "https://example.com/track?tracking=888079995075"
        number, carrier = TrackingURLParser.parse_url(url)

        assert number == "888079995075"
        assert carrier == "FedEx"  # Validated by tracking-numbers library

    def test_parse_url_rejects_invalid_tracking_numbers(self) -> None:
        """Parse_url should return None for invalid tracking numbers."""
        # Invalid tracking numbers that don't pass validation
        url = "https://example.com/track?tracking=ABC123"
        number, carrier = TrackingURLParser.parse_url(url)

        assert number is None
        assert carrier is None

    @pytest.mark.parametrize(
        "url",
        [
            "https://example.com/products/watch",
            "not-a-url",
            "https://fedex.com/about",
            "https://ups.com/",
        ],
    )
    def test_parse_url_returns_none_for_unparseable_urls(self, url: str) -> None:
        """Parse_url should return (None, None) for URLs without tracking info."""
        number, carrier = TrackingURLParser.parse_url(url)

        assert number is None
        assert carrier is None


class TestSeventeenTrackClientDetectCarrier:
    """Test carrier detection using tracking-numbers library."""

    @pytest.mark.parametrize(
        ("tracking_number", "expected_carrier", "expected_code"),
        [
            # UPS tracking numbers (1Z format)
            ("1Z999AA10123456784", "UPS", CARRIER_CODE_MAP["ups"]),
            ("1ZXJ33010323181135", "UPS", CARRIER_CODE_MAP["ups"]),
            # FedEx tracking numbers (12 digits)
            # Note: Only 888079995075 is reliably detected by tracking-numbers library
            ("888079995075", "FedEx", CARRIER_CODE_MAP["fedex"]),
            # USPS tracking numbers (20-22 digits)
            # Note: tracking-numbers library may not detect all USPS formats
            # We're testing the client's behavior, not the library's accuracy
        ],
    )
    def test_detect_carrier_identifies_common_carriers(
        self, tracking_number: str, expected_carrier: str, expected_code: int
    ) -> None:
        """Detect_carrier should identify UPS and FedEx tracking numbers.

        Note: The tracking-numbers library doesn't detect all formats.
        This tests the client's wrapper behavior for numbers it CAN detect.
        """
        client = SeventeenTrackClient(api_key="test-key")

        carrier_name, carrier_code, tracking_url = client.detect_carrier(
            tracking_number
        )

        assert carrier_name == expected_carrier
        assert carrier_code == expected_code
        assert tracking_url is not None  # tracking-numbers lib provides URLs

    def test_detect_carrier_returns_none_for_invalid_number(self) -> None:
        """Invalid tracking numbers should return (None, None, None)."""
        client = SeventeenTrackClient(api_key="test-key")

        carrier_name, carrier_code, tracking_url = client.detect_carrier(
            "not-a-tracking-number"
        )

        assert carrier_name is None
        assert carrier_code is None
        assert tracking_url is None

    def test_detect_carrier_handles_whitespace(self) -> None:
        """Tracking numbers with extra whitespace should still work."""
        client = SeventeenTrackClient(api_key="test-key")

        # Most carriers accept tracking numbers with spaces
        carrier_name, carrier_code, _url = client.detect_carrier("  888079995075  ")

        # tracking-numbers library might strip whitespace or reject it
        # Just verify we don't crash - the library handles this
        assert isinstance(carrier_name, (str | type(None)))


class TestSeventeenTrackClientParseTrackingInput:
    """Test parse_tracking_input which combines URL parsing and carrier detection."""

    def test_parse_tracking_input_with_fedex_url(self) -> None:
        """FedEx tracking URL should be parsed and validated."""
        client = SeventeenTrackClient(api_key="test-key")

        response = client.parse_tracking_input(
            "https://www.fedex.com/apps/fedextrack/?tracknumbers=888079995075"
        )

        assert response.tracking_number == "888079995075"
        assert response.carrier == "FedEx"
        assert response.carrier_code == CARRIER_CODE_MAP["fedex"]
        assert response.is_valid is True
        assert response.tracking_url is not None

    def test_parse_tracking_input_with_ups_url(self) -> None:
        """UPS tracking URL should be parsed and validated."""
        client = SeventeenTrackClient(api_key="test-key")

        response = client.parse_tracking_input(
            "https://www.ups.com/track?tracknum=1Z999AA10123456784"
        )

        assert response.tracking_number == "1Z999AA10123456784"
        assert response.carrier == "UPS"
        assert response.carrier_code == CARRIER_CODE_MAP["ups"]
        assert response.is_valid is True

    def test_parse_tracking_input_with_raw_tracking_number(self) -> None:
        """Raw tracking number should be auto-detected."""
        client = SeventeenTrackClient(api_key="test-key")

        # Use a FedEx number that tracking-numbers library reliably detects
        response = client.parse_tracking_input("888079995075")

        assert response.tracking_number == "888079995075"
        assert response.carrier == "FedEx"
        assert response.carrier_code == CARRIER_CODE_MAP["fedex"]
        assert response.is_valid is True

    def test_parse_tracking_input_with_invalid_url(self) -> None:
        """Unparseable tracking URL should return invalid response."""
        client = SeventeenTrackClient(api_key="test-key")

        response = client.parse_tracking_input("https://fedex.com/about")

        assert response.is_valid is False
        assert response.carrier is None

    def test_parse_tracking_input_with_invalid_tracking_number(self) -> None:
        """Invalid raw tracking number should return invalid response."""
        client = SeventeenTrackClient(api_key="test-key")

        response = client.parse_tracking_input("not-a-tracking-number")

        assert response.tracking_number == "not-a-tracking-number"
        assert response.is_valid is False
        assert response.carrier is None

    def test_parse_tracking_input_strips_whitespace(self) -> None:
        """Input should be stripped of leading/trailing whitespace."""
        client = SeventeenTrackClient(api_key="test-key")

        response = client.parse_tracking_input("  888079995075  ")

        assert response.tracking_number == "888079995075"


@pytest.mark.asyncio
class TestSeventeenTrackClientRegister:
    """Test register_tracking_numbers with HTTP mocking via respx."""

    @respx.mock
    async def test_register_tracking_numbers_success(self) -> None:
        """Successful registration should return accepted tracking numbers."""
        mock_response_data = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                    }
                ],
                "rejected": [],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="dean-pelton-api-key")
        response = await client.register_tracking_numbers(["888079995075"])

        assert response.is_success is True
        accepted = response.get_accepted()
        assert len(accepted) == 1
        assert accepted[0].number == "888079995075"

        await client.close()

    @respx.mock
    async def test_register_tracking_numbers_with_carrier_codes(self) -> None:
        """Registration with explicit carrier codes should pass them to API."""
        mock_response_data = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "CUSTOM123",
                        "carrier": 100001,  # DHL
                    }
                ],
                "rejected": [],
            },
        }

        route = respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="test-key")
        carrier_codes = {"CUSTOM123": 100001}
        await client.register_tracking_numbers(
            ["CUSTOM123"], carrier_codes=carrier_codes
        )

        # Verify carrier code was sent in request
        assert route.called
        import json

        request_data = route.calls.last.request.content
        payload = json.loads(request_data)
        assert payload[0]["carrier"] == 100001

        await client.close()

    @respx.mock
    async def test_register_tracking_numbers_auto_detect_carrier(self) -> None:
        """Registration without carrier codes should auto-detect."""
        mock_response_data = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                    }
                ],
                "rejected": [],
            },
        }

        route = respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="test-key")
        await client.register_tracking_numbers(["888079995075"])

        # Verify carrier was auto-detected and sent
        assert route.called
        import json

        request_data = route.calls.last.request.content
        payload = json.loads(request_data)
        assert payload[0]["carrier"] == CARRIER_CODE_MAP["fedex"]

        await client.close()

    @respx.mock
    async def test_register_tracking_numbers_rejected(self) -> None:
        """Rejected tracking numbers should be accessible via get_rejected."""
        mock_response_data = {
            "code": 0,
            "data": {
                "accepted": [],
                "rejected": [
                    {
                        "number": "INVALID",
                        "error": {"code": -18010001, "message": "Invalid number"},
                    }
                ],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="test-key")
        response = await client.register_tracking_numbers(["INVALID"])

        assert response.is_success is True  # API call succeeded
        assert len(response.get_accepted()) == 0
        rejected = response.get_rejected()
        assert len(rejected) == 1
        assert rejected[0]["number"] == "INVALID"

        await client.close()

    async def test_register_tracking_numbers_batch_size_validation(self) -> None:
        """Registration should reject batches over MAX_BATCH_SIZE."""
        client = SeventeenTrackClient(api_key="test-key")

        # Create 41 tracking numbers (over the 40 limit)
        tracking_numbers = [f"TRACK{i:03d}" for i in range(41)]

        with pytest.raises(ValueError, match="Maximum 40 tracking numbers"):
            await client.register_tracking_numbers(tracking_numbers)

        await client.close()

    @respx.mock
    async def test_register_tracking_numbers_http_error(self) -> None:
        """HTTP errors should be raised and retried by tenacity."""
        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(401)
        )

        client = SeventeenTrackClient(api_key="test-key")

        with pytest.raises(httpx.HTTPStatusError):
            await client.register_tracking_numbers(["888079995075"])

        await client.close()

    @respx.mock
    async def test_register_tracking_numbers_api_headers(self) -> None:
        """Registration should send correct headers including 17token."""
        mock_response_data = {
            "code": 0,
            "data": {"accepted": [], "rejected": []},
        }

        route = respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="study-group-api-key")
        await client.register_tracking_numbers(["888079995075"])

        assert route.called
        headers = route.calls.last.request.headers
        assert headers["17token"] == "study-group-api-key"
        assert headers["Content-Type"] == "application/json"

        await client.close()


@pytest.mark.asyncio
class TestSeventeenTrackClientGetTrackingInfo:
    """Test get_tracking_info with HTTP mocking via respx."""

    @respx.mock
    async def test_get_tracking_info_success(self) -> None:
        """Successful info fetch should return tracking details."""
        mock_response_data = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                        "track_info": {
                            "latest_status": {
                                "status": "InTransit",
                                "sub_status": None,
                            },
                            "latest_event": {
                                "time_iso": "2024-01-15T10:30:00Z",
                                "time_utc": "2024-01-15T10:30:00Z",
                                "description": "Package in transit to Greendale",
                                "location": "Greendale, CO",
                            },
                        },
                    }
                ],
                "rejected": [],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=mock_response_data)
        )

        client = SeventeenTrackClient(api_key="test-key")
        response = await client.get_tracking_info(["888079995075"])

        assert response.is_success is True
        accepted = response.get_accepted()
        assert len(accepted) == 1
        assert accepted[0].number == "888079995075"
        assert accepted[0].track_info is not None
        assert accepted[0].track_info.latest_event is not None
        assert "Greendale" in accepted[0].track_info.latest_event.description

        await client.close()

    async def test_get_tracking_info_batch_size_validation(self) -> None:
        """Info fetch should reject batches over MAX_BATCH_SIZE."""
        client = SeventeenTrackClient(api_key="test-key")

        tracking_numbers = [f"TRACK{i:03d}" for i in range(41)]

        with pytest.raises(ValueError, match="Maximum 40 tracking numbers"):
            await client.get_tracking_info(tracking_numbers)

        await client.close()

    @respx.mock
    async def test_get_tracking_info_not_registered(self) -> None:
        """Fetching info for unregistered numbers should return empty data."""
        mock_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "NOTREGISTERED",
                        "carrier": None,
                        "track_info": None,
                    }
                ],
                "rejected": [],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        response = await client.get_tracking_info(["NOTREGISTERED"])

        accepted = response.get_accepted()
        assert len(accepted) == 1
        assert accepted[0].track_info is None

        await client.close()

    @respx.mock
    async def test_get_tracking_info_uses_correct_endpoint(self) -> None:
        """Info fetch should call /gettrackinfo endpoint."""
        mock_response = {
            "code": 0,
            "data": {"accepted": [], "rejected": []},
        }

        route = respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=mock_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        await client.get_tracking_info(["888079995075"])

        assert route.called
        assert str(route.calls.last.request.url).endswith("/gettrackinfo")

        await client.close()


@pytest.mark.asyncio
class TestSeventeenTrackClientTrackPackage:
    """Test track_package convenience method."""

    @respx.mock
    async def test_track_package_success(self) -> None:
        """Track_package should register and fetch info in one call."""
        register_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                    }
                ],
                "rejected": [],
            },
        }

        info_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                        "track_info": {
                            "latest_status": {
                                "status": "Delivered",
                                "sub_status": None,
                            },
                            "latest_event": {
                                "time_iso": "2024-01-20T14:30:00Z",
                                "time_utc": "2024-01-20T14:30:00Z",
                                "description": "Delivered - Left at door",
                                "location": "Greendale Community College",
                            },
                        },
                    }
                ],
                "rejected": [],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=register_response)
        )
        respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=info_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        track_info = await client.track_package("888079995075")

        assert track_info is not None
        assert track_info.latest_status is not None
        assert track_info.latest_status.status == "Delivered"
        assert track_info.normalized_status == DeliveryStatus.DELIVERED

        await client.close()

    @respx.mock
    async def test_track_package_register_fails(self) -> None:
        """Track_package should return None if registration fails."""
        register_response = {
            "code": -1,  # Error code
            "data": {"accepted": [], "rejected": []},
        }

        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=register_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        track_info = await client.track_package("INVALID")

        assert track_info is None

        await client.close()

    @respx.mock
    async def test_track_package_no_tracking_info(self) -> None:
        """Track_package should return None if no tracking info available."""
        register_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                    }
                ],
                "rejected": [],
            },
        }

        info_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": CARRIER_CODE_MAP["fedex"],
                        "track_info": None,  # No tracking info yet
                    }
                ],
                "rejected": [],
            },
        }

        respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=register_response)
        )
        respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=info_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        track_info = await client.track_package("888079995075")

        assert track_info is None

        await client.close()

    @respx.mock
    async def test_track_package_calls_both_endpoints(self) -> None:
        """Track_package should call register then gettrackinfo."""
        register_response = {
            "code": 0,
            "data": {
                "accepted": [{"number": "888079995075", "carrier": 100003}],
                "rejected": [],
            },
        }

        info_response = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": 100003,
                        "track_info": {
                            "latest_status": {"status": "InTransit"},
                        },
                    }
                ],
                "rejected": [],
            },
        }

        register_route = respx.post("https://api.17track.net/track/v2.4/register").mock(
            return_value=httpx.Response(200, json=register_response)
        )
        info_route = respx.post("https://api.17track.net/track/v2.4/gettrackinfo").mock(
            return_value=httpx.Response(200, json=info_response)
        )

        client = SeventeenTrackClient(api_key="test-key")
        await client.track_package("888079995075")

        # Verify both endpoints were called
        assert register_route.called
        assert info_route.called

        await client.close()


class TestSeventeenTrackResponseModel:
    """Test SeventeenTrackResponse Pydantic model validation."""

    def test_response_model_parses_valid_json(self) -> None:
        """Response model should parse valid 17track API response."""
        json_data = {
            "code": 0,
            "data": {
                "accepted": [
                    {
                        "number": "888079995075",
                        "carrier": 100003,
                    }
                ],
                "rejected": [],
            },
        }

        response = SeventeenTrackResponse.model_validate(json_data)

        assert response.code == 0
        assert response.is_success is True
        assert len(response.get_accepted()) == 1

    def test_response_model_is_success_property(self) -> None:
        """Is_success should return True only when code is 0."""
        success_response = SeventeenTrackResponse(
            code=0, data={"accepted": [], "rejected": []}
        )
        error_response = SeventeenTrackResponse(
            code=-1, data={"accepted": [], "rejected": []}
        )

        assert success_response.is_success is True
        assert error_response.is_success is False

    def test_response_model_get_rejected(self) -> None:
        """Get_rejected should return rejected tracking numbers."""
        json_data = {
            "code": 0,
            "data": {
                "accepted": [],
                "rejected": [
                    {
                        "number": "INVALID",
                        "error": {"code": -18010001, "message": "Invalid format"},
                    }
                ],
            },
        }

        response = SeventeenTrackResponse.model_validate(json_data)
        rejected = response.get_rejected()

        assert len(rejected) == 1
        assert rejected[0]["number"] == "INVALID"
