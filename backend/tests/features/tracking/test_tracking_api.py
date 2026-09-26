"""API-level tests for tracking endpoints.

Like testing the Community study room's various entrances,
we test all the ways data flows through the API.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import Settings, settings
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item
from tests.utils.user import (
    user_authentication_headers,
)
from tests.utils.utils import random_email, random_lower_string


class TestTrackingListEndpoint:
    """Test GET /tracking endpoint."""

    def test_list_tracked_items_returns_tracking_status_items(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking should return items with TRACKING status."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="FedEx Package",
                price_cents=39900,
                tracking_number="888079995075",
                tracking_carrier="FedEx",
            ),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == str(tracked_item.id)
        assert data["data"][0]["status"] == "tracking"
        assert data["data"][0]["tracking_number"] == "888079995075"

    def test_list_tracked_items_excludes_wishlisted(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking should NOT return regular wishlisted items."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        wishlisted_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Regular Wishlist Item",
                price_cents=2000,
            ),
            user.id,
        )

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="USPS Package",
                price_cents=1000,
                tracking_number="9214490358937913278325",
                tracking_carrier="USPS",
            ),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        item_ids = [item["id"] for item in data["data"]]
        assert str(tracked_item.id) in item_ids
        assert str(wishlisted_item.id) not in item_ids


class TestCreateTrackedItem:
    """Test creating items via POST /items endpoint with tracking data."""

    def test_create_item_with_tracking_number_via_api(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /items with tracking_number should create TRACKING status item."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/",
            headers=headers,
            json={
                "title": "UPS Package",
                "price_cents": 5000,
                "tracking_number": "1ZXJ33010323181135",
                "tracking_carrier": "UPS",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "tracking"
        assert data["tracking_number"] == "1ZXJ33010323181135"
        assert data["tracking_carrier"] == "UPS"

    def test_create_item_without_tracking_via_api(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /items without tracking_number should create WISHLISTED item."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/",
            headers=headers,
            json={
                "title": "Regular Wishlist Item",
                "price_cents": 2000,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "wishlisted"
        assert data.get("tracking_number") is None


class TestTrackingItemInWishlistEndpoint:
    """Test that wishlisted endpoint shows/hides tracking items correctly."""

    def test_get_items_returns_all_statuses(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /items should return items of ALL statuses (filtering is client-side)."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        wishlisted_item = create_wishlist_item(
            session,
            WishlistItemCreate(title="Wishlist", price_cents=1000),
            user.id,
        )

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked",
                price_cents=2000,
                tracking_number="888079995075",
            ),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        item_ids = [item["id"] for item in data["data"]]

        assert str(wishlisted_item.id) in item_ids
        assert str(tracked_item.id) in item_ids


class TestTrackingParseEndpoint:
    """Test POST /tracking/parse endpoint.

    Like Troy's DVD commentary, we're testing parsing skills.
    """

    def test_parse_valid_fedex_tracking_number(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with FedEx number should detect carrier."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "888079995075"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "888079995075"
        assert data["carrier"] is not None
        assert data["is_valid"] is True

    def test_parse_valid_ups_tracking_number(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with UPS number should detect carrier."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "1Z999AA10123456784"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "1Z999AA10123456784"
        assert data["carrier"] is not None
        assert data["is_valid"] is True

    def test_parse_valid_usps_tracking_number(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with USPS number should detect carrier."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "9214490358937913278325"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "9214490358937913278325"
        assert data["carrier"] is not None
        assert data["is_valid"] is True

    def test_parse_tracking_url(self, client: TestClient, session: Session) -> None:
        """POST /tracking/parse with tracking URL should extract number and carrier."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={
                "input": "https://www.fedex.com/fedextrack/?tracknumbers=888079995075"
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "888079995075"
        assert data["carrier"] is not None
        assert data["is_valid"] is True

    def test_parse_requires_authentication(self, client: TestClient) -> None:
        """POST /tracking/parse requires authentication like Study Room F."""
        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            json={"input": "888079995075"},
        )

        assert response.status_code == 401

    def test_parse_tracking_when_disabled_returns_503(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse returns 503 when tracking is disabled."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Mock the settings object with tracking disabled
        mock_settings = MagicMock(spec=Settings)
        mock_settings.tracking_enabled = False
        mock_settings.API_V1_STR = settings.API_V1_STR

        with patch("app.features.tracking.router.settings", mock_settings):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/parse",
                headers=headers,
                json={"input": "888079995075"},
            )

        assert response.status_code == 503
        assert "not enabled" in response.json()["detail"].lower()

    def test_parse_invalid_tracking_number(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with invalid number returns is_valid=False."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "not-a-real-tracking-number-at-all"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False

    def test_parse_amazon_tracking_number(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with Amazon TBA number should detect carrier.

        Like Jeff's Amazon Prime delivery to the study room.
        """
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "TBA123456789000"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "TBA123456789000"
        assert data["is_valid"] is True

    def test_parse_ups_tracking_url(self, client: TestClient, session: Session) -> None:
        """POST /tracking/parse with UPS URL extracts number and carrier.

        Like tracking the boulder's delivery to the school.
        """
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={"input": "https://www.ups.com/track?tracknum=1Z999AA10123456784"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "1Z999AA10123456784"
        assert data["carrier"] is not None
        assert data["is_valid"] is True

    def test_parse_usps_tracking_url(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/parse with USPS URL extracts number and carrier."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/parse",
            headers=headers,
            json={
                "input": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9214490358937913278325"
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "9214490358937913278325"
        assert data["carrier"] is not None
        assert data["is_valid"] is True


class TestTrackingStatusEndpoint:
    """Test GET /tracking/{item_id}/status endpoint.

    Like tracking Abed's timeline sanity, we test tracking status retrieval.
    """

    def test_get_status_for_item_with_tracking_data(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns parsed tracking data."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create item with tracking data (like a paintball trophy delivery)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Paintball Trophy",
                price_cents=5000,
                tracking_number="1Z999AA10123456784",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        # Populate tracking_data
        item.tracking_data = {
            "latest_status": {"status": "InTransit", "sub_status": None},
            "latest_event": {
                "description": "Package has left seller facility",
                "location": "Greendale, CO",
                "time_iso": "2024-01-15T10:00:00Z",
                "time_utc": "2024-01-15T10:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "UPS", "alias": "UPS"},
                        "events": [
                            {
                                "description": "Package has left seller facility",
                                "location": "Greendale, CO",
                                "time_iso": "2024-01-15T10:00:00Z",
                                "time_utc": "2024-01-15T10:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }
        session.add(item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "1Z999AA10123456784"
        assert data["carrier"] == "UPS"
        assert data["status"] == "in_transit"
        assert data["latest_event_description"] == "Package has left seller facility"
        assert data["latest_event_location"] == "Greendale, CO"

    def test_get_status_for_item_without_tracking_data(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns NOT_FOUND for items without data."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Item with tracking number but no synced data yet
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Unsynced Package",
                price_cents=3000,
                tracking_number="888079995075",
            ),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_found"
        assert data["tracking_number"] == "888079995075"

    def test_get_status_for_item_without_tracking_number_returns_404(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns 404 for items without tracking number."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Regular wishlist item (like Annie's Boobs the monkey - no tracking)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(title="Regular Item", price_cents=1000),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 404
        assert "No tracking information" in response.json()["detail"]

    def test_get_status_for_nonexistent_item_returns_404(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns 404 for nonexistent item."""
        email = random_email()
        password = random_lower_string()

        from uuid import uuid4

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        fake_id = uuid4()
        response = client.get(
            f"{settings.API_V1_STR}/tracking/{fake_id}/status",
            headers=headers,
        )

        assert response.status_code == 404

    def test_get_status_requires_authentication(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status requires authentication."""
        from uuid import uuid4

        fake_id = uuid4()
        response = client.get(f"{settings.API_V1_STR}/tracking/{fake_id}/status")

        assert response.status_code == 401

    def test_get_status_for_delivered_item(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns DELIVERED status for delivered items.

        Like Annie's pen finally arriving at her new apartment.
        """
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Annie's Pen",
                price_cents=1500,
                tracking_number="9214490358937913278325",
                tracking_carrier="USPS",
            ),
            user.id,
        )

        # Simulate delivered tracking data
        item.tracking_data = {
            "latest_status": {"status": "Delivered", "sub_status": None},
            "latest_event": {
                "description": "Delivered to mailbox",
                "location": "Greendale Community College",
                "time_iso": "2024-01-20T14:30:00Z",
                "time_utc": "2024-01-20T14:30:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "USPS", "alias": "USPS"},
                        "events": [
                            {
                                "description": "Delivered to mailbox",
                                "location": "Greendale Community College",
                                "time_iso": "2024-01-20T14:30:00Z",
                                "time_utc": "2024-01-20T14:30:00Z",
                            }
                        ],
                    }
                ]
            },
        }
        session.add(item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "delivered"
        assert data["status_label"] == "Delivered"
        assert data["latest_event_description"] == "Delivered to mailbox"

    def test_get_status_for_out_for_delivery_item(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns OUT_FOR_DELIVERY status correctly.

        Like Troy's dreamatorium furniture about to arrive.
        """
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Dreamatorium Parts",
                price_cents=25000,
                tracking_number="1Z999AA10123456784",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        # Simulate out for delivery tracking data
        item.tracking_data = {
            "latest_status": {
                "status": "InTransit",
                "sub_status": "OutForDelivery",
            },
            "latest_event": {
                "description": "Out for delivery",
                "location": "Greendale, CO",
                "time_iso": "2024-01-24T08:00:00Z",
                "time_utc": "2024-01-24T08:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "UPS", "alias": "UPS"},
                        "events": [
                            {
                                "description": "Out for delivery",
                                "location": "Greendale, CO",
                                "time_iso": "2024-01-24T08:00:00Z",
                                "time_utc": "2024-01-24T08:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }
        session.add(item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "out_for_delivery"
        assert data["status_label"] == "Out For Delivery"
        assert data["latest_event_description"] == "Out for delivery"

    def test_get_status_for_exception_item(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status returns EXCEPTION status for delivery issues.

        Like Chang's tiger getting stuck at customs.
        """
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Live Tiger",
                price_cents=1000000,
                tracking_number="888079995075",
                tracking_carrier="FedEx",
            ),
            user.id,
        )

        # Simulate exception tracking data
        item.tracking_data = {
            "latest_status": {"status": "Exception", "sub_status": None},
            "latest_event": {
                "description": "Delivery exception - recipient unavailable",
                "location": "Denver, CO",
                "time_iso": "2024-01-23T15:00:00Z",
                "time_utc": "2024-01-23T15:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "FedEx", "alias": "FedEx"},
                        "events": [
                            {
                                "description": "Delivery exception - recipient unavailable",
                                "location": "Denver, CO",
                                "time_iso": "2024-01-23T15:00:00Z",
                                "time_utc": "2024-01-23T15:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }
        session.add(item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "exception"
        assert data["status_label"] == "Exception"
        assert "exception" in data["latest_event_description"].lower()

    def test_get_status_with_estimated_delivery(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking/{item_id}/status includes estimated delivery date when available."""
        from datetime import datetime, timezone

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Textbook",
                price_cents=8000,
                tracking_number="1Z999AA10123456784",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        # Set the estimated delivery on the item directly
        item.estimated_delivery_at = datetime(2024, 1, 25, 0, 0, 0, tzinfo=timezone.utc)

        # Simulate tracking data with estimated delivery
        item.tracking_data = {
            "latest_status": {"status": "InTransit", "sub_status": None},
            "latest_event": {
                "description": "Package arrived at facility",
                "location": "Denver, CO",
                "time_iso": "2024-01-22T12:00:00Z",
                "time_utc": "2024-01-22T12:00:00Z",
            },
            "time_metrics": {
                "estimated_delivery_date": {
                    "from": "2024-01-25T00:00:00Z",
                    "to": "2024-01-26T00:00:00Z",
                    "source": "carrier",
                }
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "UPS", "alias": "UPS"},
                        "events": [
                            {
                                "description": "Package arrived at facility",
                                "location": "Denver, CO",
                                "time_iso": "2024-01-22T12:00:00Z",
                                "time_utc": "2024-01-22T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }
        session.add(item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking/{item.id}/status",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["estimated_delivery_at"] is not None
        assert "2024-01-25" in data["estimated_delivery_at"]


class TestSyncTrackingEndpoint:
    """Test POST /tracking/{item_id}/sync endpoint.

    Like Abed syncing timelines after dice rolls, we test tracking sync.
    """

    def test_sync_tracking_requires_authentication(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync requires authentication."""
        from uuid import uuid4

        fake_id = uuid4()
        response = client.post(f"{settings.API_V1_STR}/tracking/{fake_id}/sync")

        assert response.status_code == 401

    def test_sync_tracking_when_disabled_returns_503(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync returns 503 when tracking is disabled."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Package",
                price_cents=1000,
                tracking_number="888079995075",
            ),
            user.id,
        )

        mock_settings = MagicMock(spec=Settings)
        mock_settings.tracking_enabled = False
        mock_settings.API_V1_STR = settings.API_V1_STR

        with patch("app.features.tracking.router.settings", mock_settings):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/{item.id}/sync",
                headers=headers,
            )

        assert response.status_code == 503
        assert "not enabled" in response.json()["detail"].lower()

    def test_sync_tracking_for_item_without_tracking_number_returns_400(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync returns 400 if item has no tracking number."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Regular wishlist item without tracking
        item = create_wishlist_item(
            session,
            WishlistItemCreate(title="Regular Item", price_cents=1000),
            user.id,
        )

        response = client.post(
            f"{settings.API_V1_STR}/tracking/{item.id}/sync",
            headers=headers,
        )

        assert response.status_code == 400
        assert "no tracking number" in response.json()["detail"].lower()

    def test_sync_tracking_for_nonexistent_item_returns_404(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync returns 404 for nonexistent item."""
        email = random_email()
        password = random_lower_string()

        from uuid import uuid4

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        fake_id = uuid4()
        response = client.post(
            f"{settings.API_V1_STR}/tracking/{fake_id}/sync",
            headers=headers,
        )

        assert response.status_code == 404

    def test_sync_tracking_success_with_17track_mock(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync successfully syncs tracking data.

        Like tracking Pierce's yacht delivery from the marina.
        """
        email = random_email()
        password = random_lower_string()

        from unittest.mock import AsyncMock, patch

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Yacht Anchor",
                price_cents=50000,
                tracking_number="888079995075",
                tracking_carrier="FedEx",
            ),
            user.id,
        )

        # Mock the tracking client
        mock_track_info = {
            "latest_status": {"status": "InTransit", "sub_status": None},
            "latest_event": {
                "description": "Package departed facility",
                "location": "Los Angeles, CA",
                "time_iso": "2024-01-23T10:00:00Z",
                "time_utc": "2024-01-23T10:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "FedEx", "alias": "FedEx"},
                        "events": [
                            {
                                "description": "Package departed facility",
                                "location": "Los Angeles, CA",
                                "time_iso": "2024-01-23T10:00:00Z",
                                "time_utc": "2024-01-23T10:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }

        from app.features.tracking.models import TrackInfo

        mock_client = MagicMock()
        mock_client.track_package = AsyncMock(
            return_value=TrackInfo.model_validate(mock_track_info)
        )

        with patch(
            "app.features.tracking.service.get_tracking_client",
            return_value=mock_client,
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/{item.id}/sync",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "888079995075"
        assert data["carrier"] == "FedEx"
        assert data["status"] == "in_transit"
        assert data["latest_event_description"] == "Package departed facility"


class TestSyncAllTrackingEndpoint:
    """Test POST /tracking/sync-all endpoint.

    Like the Greendale school-wide announcements, we test syncing all tracking.
    """

    def test_sync_all_requires_authentication(self, client: TestClient) -> None:
        """POST /tracking/sync-all requires authentication."""
        response = client.post(f"{settings.API_V1_STR}/tracking/sync-all")

        assert response.status_code == 401

    def test_sync_all_when_disabled_returns_503(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/sync-all returns 503 when tracking is disabled."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Mock the settings object with tracking disabled
        mock_settings = MagicMock(spec=Settings)
        mock_settings.tracking_enabled = False
        mock_settings.API_V1_STR = settings.API_V1_STR

        with patch("app.features.tracking.router.settings", mock_settings):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/sync-all",
                headers=headers,
            )

        assert response.status_code == 503
        assert "not enabled" in response.json()["detail"].lower()

    def test_sync_all_with_no_tracked_items(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/sync-all returns 0 count when no items to sync.

        Like syncing during summer break when everyone's gone.
        """
        email = random_email()
        password = random_lower_string()

        from unittest.mock import AsyncMock, patch

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Mock sync_all_active_tracking to return 0
        with patch(
            "app.features.tracking.router.sync_all_active_tracking",
            new=AsyncMock(return_value=0),
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/sync-all",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["synced_count"] == 0
        assert "0 items" in data["message"]

    def test_sync_all_with_multiple_items(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/sync-all syncs multiple tracked items.

        Like syncing all study group members' textbook orders.
        """
        email = random_email()
        password = random_lower_string()

        from unittest.mock import AsyncMock, patch

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create multiple tracked items
        for title in [
            "Jeff's Law Book",
            "Britta's Psychology Book",
            "Abed's Film Book",
        ]:
            create_wishlist_item(
                session,
                WishlistItemCreate(
                    title=title,
                    price_cents=10000,
                    tracking_number="888079995075",
                    tracking_carrier="FedEx",
                ),
                user.id,
            )

        # Mock sync_all_active_tracking to return count of 3
        with patch(
            "app.features.tracking.router.sync_all_active_tracking",
            new=AsyncMock(return_value=3),
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/sync-all",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["synced_count"] == 3
        assert "3 items" in data["message"]


class TestTrackingListEdgeCases:
    """Test edge cases for GET /tracking endpoint.

    Like dealing with all the weird situations in Greendale's study room.
    """

    def test_list_tracking_includes_purchased_items_with_tracking(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking should include PURCHASED items that have tracking numbers.

        Like tracking Troy's cooling-off-after-buying regret purchases.
        """
        from datetime import datetime, timezone

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user
        from app.features.wishlist_item.models import WishlistItemStatus

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create a purchased item with tracking
        purchased_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Troy's Rare Spanish Textbook",
                price_cents=15000,
                tracking_number="1Z999AA10123456784",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        # Update status to PURCHASED with required timestamp
        purchased_item.status = WishlistItemStatus.PURCHASED
        purchased_item.purchased_at = datetime.now(timezone.utc)
        session.add(purchased_item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        item_ids = [item["id"] for item in data["data"]]
        assert str(purchased_item.id) in item_ids

    def test_list_tracking_includes_gifted_items_with_tracking(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking should include GIFTED items that have tracking numbers."""
        from datetime import datetime, timezone
        from uuid import uuid4

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user
        from app.features.wishlist_item.models import WishlistItemStatus

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create a gifted item with tracking
        gifted_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Pierce's Inheritance Moist Towelette",
                price_cents=100,
                tracking_number="9214490358937913278325",
                tracking_carrier="USPS",
            ),
            user.id,
        )

        # Update status to GIFTED with required fields
        gifted_item.status = WishlistItemStatus.GIFTED
        gifted_item.gifted_at = datetime.now(timezone.utc)
        gifted_item.bought_by_id = uuid4()
        session.add(gifted_item)
        session.commit()

        response = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        item_ids = [item["id"] for item in data["data"]]
        assert str(gifted_item.id) in item_ids

    def test_list_tracking_empty_when_no_tracked_items(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking returns empty list when user has no tracked items."""
        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create regular wishlist item without tracking
        create_wishlist_item(
            session,
            WishlistItemCreate(title="Regular Item", price_cents=1000),
            user.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert len(data["data"]) == 0

    def test_list_tracking_only_shows_own_items(
        self, client: TestClient, session: Session
    ) -> None:
        """GET /tracking only returns items owned by the authenticated user.

        Like Chang not being able to see the study group's tracked packages.
        """
        email1 = random_email()
        email2 = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user1 = create_user(session, UserCreate(email=email1, password=password))
        user2 = create_user(session, UserCreate(email=email2, password=password))

        # User1 creates tracked item
        user1_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="User1's Package",
                price_cents=5000,
                tracking_number="888079995075",
            ),
            user1.id,
        )

        # User2 creates tracked item
        user2_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="User2's Package",
                price_cents=3000,
                tracking_number="1Z999AA10123456784",
            ),
            user2.id,
        )

        # User1 checks tracking
        headers1 = user_authentication_headers(
            client=client, email=email1, password=password
        )
        response1 = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers1,
        )

        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["count"] == 1
        assert data1["data"][0]["id"] == str(user1_item.id)

        # User2 checks tracking
        headers2 = user_authentication_headers(
            client=client, email=email2, password=password
        )
        response2 = client.get(
            f"{settings.API_V1_STR}/tracking",
            headers=headers2,
        )

        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["count"] == 1
        assert data2["data"][0]["id"] == str(user2_item.id)


class TestSyncTrackingCoverage:
    """Additional tests for tracking sync endpoints to improve coverage.

    Like tracking all the packages arriving at the study room during the holidays.
    """

    def test_sync_never_synced_item_calls_register_and_sync(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync for never-synced item calls register_and_sync_tracking.

        Like tracking Troy's first-ever online purchase from the Air Conditioning Repair School.
        """
        from unittest.mock import AsyncMock, MagicMock, patch

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create item that has never been synced
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Troy's AC Repair Manual",
                price_cents=8000,
                tracking_number="1Z999AA10123456784",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        # Ensure tracking_synced_at is None
        assert item.tracking_synced_at is None

        # Mock the 17track client
        mock_track_info = {
            "latest_status": {"status": "InfoReceived", "sub_status": None},
            "latest_event": {
                "description": "Shipment information received",
                "location": "Greendale, CO",
                "time_iso": "2024-01-24T09:00:00Z",
                "time_utc": "2024-01-24T09:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "UPS", "alias": "UPS"},
                        "events": [
                            {
                                "description": "Shipment information received",
                                "location": "Greendale, CO",
                                "time_iso": "2024-01-24T09:00:00Z",
                                "time_utc": "2024-01-24T09:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }

        from app.features.tracking.models import TrackInfo

        mock_client = MagicMock()
        mock_client.track_package = AsyncMock(
            return_value=TrackInfo.model_validate(mock_track_info)
        )

        with patch(
            "app.features.tracking.service.get_tracking_client",
            return_value=mock_client,
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/{item.id}/sync",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "1Z999AA10123456784"
        assert data["status"] == "info_received"
        assert data["latest_event_description"] == "Shipment information received"

        # Verify track_package was called (registration)
        mock_client.track_package.assert_called_once_with("1Z999AA10123456784")

    def test_sync_already_synced_item_calls_sync_item_tracking(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync for already-synced item calls sync_item_tracking.

        Like refreshing the status of Annie's pen that's been in transit for days.
        """
        from datetime import datetime, timezone
        from unittest.mock import AsyncMock, MagicMock, patch

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create item that has been synced before
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Annie's Purple Pen",
                price_cents=500,
                tracking_number="9214490358937913278325",
                tracking_carrier="USPS",
            ),
            user.id,
        )

        # Set tracking_synced_at to indicate prior sync
        item.tracking_synced_at = datetime(2024, 1, 23, 0, 0, 0, tzinfo=timezone.utc)
        session.add(item)
        session.commit()

        # Mock the 17track client for get_tracking_info
        mock_track_info = {
            "latest_status": {"status": "InTransit", "sub_status": None},
            "latest_event": {
                "description": "Arrived at postal facility",
                "location": "Denver, CO",
                "time_iso": "2024-01-24T10:00:00Z",
                "time_utc": "2024-01-24T10:00:00Z",
            },
            "tracking": {
                "providers": [
                    {
                        "provider": {"key": 1, "name": "USPS", "alias": "USPS"},
                        "events": [
                            {
                                "description": "Arrived at postal facility",
                                "location": "Denver, CO",
                                "time_iso": "2024-01-24T10:00:00Z",
                                "time_utc": "2024-01-24T10:00:00Z",
                            }
                        ],
                    }
                ]
            },
        }

        from app.features.tracking.models import (
            SeventeenTrackResponse,
            TrackInfo,
            TrackingResult,
        )

        mock_result = TrackingResult(
            number="9214490358937913278325",
            carrier=1,
            track_info=TrackInfo.model_validate(mock_track_info),
        )

        mock_response = MagicMock(spec=SeventeenTrackResponse)
        mock_response.is_success = True
        mock_response.get_accepted = MagicMock(return_value=[mock_result])

        mock_client = MagicMock()
        mock_client.get_tracking_info = AsyncMock(return_value=mock_response)

        with patch(
            "app.features.tracking.service.get_tracking_client",
            return_value=mock_client,
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/{item.id}/sync",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["tracking_number"] == "9214490358937913278325"
        assert data["status"] == "in_transit"
        assert data["latest_event_description"] == "Arrived at postal facility"

        # Verify get_tracking_info was called (not track_package)
        mock_client.get_tracking_info.assert_called_once_with(
            ["9214490358937913278325"]
        )

    def test_sync_all_syncs_multiple_items(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/sync-all syncs multiple tracked items.

        Like syncing all the study group's textbook orders from Greendale Books.
        """
        from unittest.mock import AsyncMock, MagicMock, patch

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create multiple tracked items for different study group members
        items_data = [
            ("Jeff's Law Textbook", "888079995075", "FedEx"),
            ("Britta's Psychology Book", "1Z999AA10123456784", "UPS"),
            ("Abed's Film Theory Book", "9214490358937913278325", "USPS"),
        ]

        for title, tracking_number, carrier in items_data:
            create_wishlist_item(
                session,
                WishlistItemCreate(
                    title=title,
                    price_cents=12000,
                    tracking_number=tracking_number,
                    tracking_carrier=carrier,
                ),
                user.id,
            )

        # Mock sync_all_active_tracking to simulate successful sync
        with patch(
            "app.features.tracking.service.get_tracking_client"
        ) as mock_get_client:
            # Create mock client
            mock_client = MagicMock()

            # Create mock tracking results
            from app.features.tracking.models import (
                SeventeenTrackResponse,
                TrackInfo,
                TrackingResult,
            )

            mock_results = []
            for _, tracking_number, carrier in items_data:
                track_info_data = {
                    "latest_status": {"status": "InTransit", "sub_status": None},
                    "latest_event": {
                        "description": "In transit",
                        "location": "Greendale, CO",
                        "time_iso": "2024-01-24T12:00:00Z",
                        "time_utc": "2024-01-24T12:00:00Z",
                    },
                    "tracking": {
                        "providers": [
                            {
                                "provider": {
                                    "key": 1,
                                    "name": carrier,
                                    "alias": carrier,
                                },
                                "events": [
                                    {
                                        "description": "In transit",
                                        "location": "Greendale, CO",
                                        "time_iso": "2024-01-24T12:00:00Z",
                                        "time_utc": "2024-01-24T12:00:00Z",
                                    }
                                ],
                            }
                        ]
                    },
                }
                mock_results.append(
                    TrackingResult(
                        number=tracking_number,
                        carrier=1,
                        track_info=TrackInfo.model_validate(track_info_data),
                    )
                )

            mock_response = MagicMock(spec=SeventeenTrackResponse)
            mock_response.is_success = True
            mock_response.get_accepted = MagicMock(return_value=mock_results)

            mock_client.get_tracking_info = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            response = client.post(
                f"{settings.API_V1_STR}/tracking/sync-all",
                headers=headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["synced_count"] == 3
        assert "3 items" in data["message"]

    def test_sync_item_with_api_failure_still_updates_synced_at(
        self, client: TestClient, session: Session
    ) -> None:
        """POST /tracking/{item_id}/sync updates synced_at even if API returns no data.

        Like the college's mail room losing track of Pierce's package.
        """
        from datetime import datetime, timezone
        from unittest.mock import AsyncMock, MagicMock, patch

        email = random_email()
        password = random_lower_string()

        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(session, UserCreate(email=email, password=password))
        headers = user_authentication_headers(
            client=client, email=email, password=password
        )

        # Create item with prior sync
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Pierce's Mystery Package",
                price_cents=100000,
                tracking_number="888079995075",
                tracking_carrier="FedEx",
            ),
            user.id,
        )

        item.tracking_synced_at = datetime(2024, 1, 20, 0, 0, 0, tzinfo=timezone.utc)
        session.add(item)
        session.commit()

        # Mock response with no tracking info
        from app.features.tracking.models import SeventeenTrackResponse, TrackingResult

        mock_result = TrackingResult(
            number="888079995075",
            carrier=1,
            track_info=None,  # No tracking info available
        )

        mock_response = MagicMock(spec=SeventeenTrackResponse)
        mock_response.is_success = True
        mock_response.get_accepted = MagicMock(return_value=[mock_result])

        mock_client = MagicMock()
        mock_client.get_tracking_info = AsyncMock(return_value=mock_response)

        with patch(
            "app.features.tracking.service.get_tracking_client",
            return_value=mock_client,
        ):
            response = client.post(
                f"{settings.API_V1_STR}/tracking/{item.id}/sync",
                headers=headers,
            )

        assert response.status_code == 200

        # Verify item was updated with new synced_at time
        session.refresh(item)
        old_synced_at = datetime(2024, 1, 20, 0, 0, 0, tzinfo=timezone.utc)
        assert item.tracking_synced_at is not None
        # Convert both to timezone-aware if needed for comparison
        if item.tracking_synced_at.tzinfo is None:
            item_synced_aware = item.tracking_synced_at.replace(tzinfo=timezone.utc)
        else:
            item_synced_aware = item.tracking_synced_at
        assert item_synced_aware > old_synced_at
