"""Service-level tests using HTML fixtures.

Tests the full extraction pipeline by mocking HTTP fetches to return fixture HTML.
Named after Community episodes because... it's a small college, you've heard of it.
"""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.features.url_parser.models import FetchResult, ProductMetadata
from app.features.url_parser.service import (
    ParseError,
    _is_challenge_page,
    _is_garbage_title,
    _merge_metadata,
    _try_extract,
    parse_url,
    strip_tracking_params,
)
from app.features.url_parser.strategies import (
    JsonLdStrategy,
    MicrodataStrategy,
    OpenGraphStrategy,
)

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures" / "html"


def load_fixture(name: str) -> str:
    """Load HTML fixture like loading up the Dreamatorium."""
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


def served(html: str, url: str = "https://example.com/product") -> FetchResult:
    """A fetch that answered from the URL it was asked for."""
    return FetchResult(html, url)


class TestStripTrackingParams:
    """Tests for URL cleaning - removing marketing noise from URLs."""

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            (
                "https://example.com/product?utm_source=google&id=123",
                "https://example.com/product?id=123",
            ),
            (
                "https://example.com/product?gclid=abc123&color=blue",
                "https://example.com/product?color=blue",
            ),
            (
                "https://example.com/product?fbclid=xyz&ref=social",
                "https://example.com/product",
            ),
            (
                "https://example.com/product",
                "https://example.com/product",
            ),
            (
                "https://example.com/product?mc_cid=123&mc_eid=456&sku=ABC",
                "https://example.com/product?sku=ABC",
            ),
        ],
        ids=[
            "utm_params",
            "google_click_id",
            "facebook_and_ref",
            "no_params",
            "mailchimp_params",
        ],
    )
    def test_strips_tracking_params(self, url: str, expected: str) -> None:
        """Strip various tracking parameters from URLs."""
        result = strip_tracking_params(url)
        assert result == expected


class TestIsChallengePage:
    """Tests for bot detection challenge page identification."""

    @pytest.mark.parametrize(
        ("html", "expected"),
        [
            ("<html>captcha-delivery.com</html>", True),
            ("<html>cf-mitigated</html>", True),
            ("<html>_cf_chl_opt</html>", True),
            ("<html>Normal product page content</html>" * 100, False),
            ("<html>location.reload()</html>", True),  # Short + reload = challenge
        ],
        ids=[
            "datadome_challenge",
            "cloudflare_mitigated",
            "cloudflare_challenge_opt",
            "normal_page",
            "js_reload_challenge",
        ],
    )
    def test_identifies_challenge_pages(self, html: str, expected: bool) -> None:
        """Detect various bot detection challenge pages."""
        result = _is_challenge_page(html)
        assert result == expected


class TestIsGarbageTitle:
    """Tests for garbage title detection."""

    @pytest.mark.parametrize(
        ("title", "url", "expected"),
        [
            ("Diamond Bezel Necklace", "https://mejuri.com/product", False),
            ("sephora", "https://www.sephora.com/product", True),
            ("Amazon.com", "https://www.amazon.com/product", True),
            ("Page not found", "https://example.com/product", True),
            ("404", "https://example.com/product", True),
            ("Just a moment", "https://example.com/product", True),  # Cloudflare
            ("AB", "https://example.com/product", True),  # Too short
            (None, "https://example.com/product", True),
            ("", "https://example.com/product", True),
        ],
        ids=[
            "valid_title",
            "site_name_only",
            "domain_as_title",
            "not_found_page",
            "error_page",
            "cloudflare_wait",
            "too_short",
            "none_title",
            "empty_title",
        ],
    )
    def test_garbage_title_detection(
        self, title: str | None, url: str, expected: bool
    ) -> None:
        """Detect garbage titles that indicate failed extraction."""
        result = _is_garbage_title(title, url)
        assert result == expected


class TestMergeMetadata:
    """Tests for metadata merging - combining the best of both timelines."""

    def test_prefers_primary_values(self) -> None:
        """Primary metadata values take precedence."""
        primary = ProductMetadata(
            title="Primary Title",
            price_cents=1000,
            source_url="https://example.com",
        )
        secondary = ProductMetadata(
            title="Secondary Title",
            price_cents=2000,
            description="Secondary Description",
            source_url="https://example.com",
        )

        result = _merge_metadata(primary, secondary)

        assert result.title == "Primary Title"
        assert result.price_cents == 1000
        assert result.description == "Secondary Description"

    def test_fills_gaps_from_secondary(self) -> None:
        """Fill missing fields from secondary metadata."""
        primary = ProductMetadata(
            title="Product Name",
            source_url="https://example.com",
        )
        secondary = ProductMetadata(
            title="Other Name",
            price_cents=5000,
            currency="USD",
            image_url="https://example.com/image.jpg",
            brand="Brand Name",
            source_url="https://example.com",
        )

        result = _merge_metadata(primary, secondary)

        assert result.title == "Product Name"  # Primary
        assert result.price_cents == 5000  # Secondary
        assert result.currency == "USD"  # Secondary
        assert result.image_url == "https://example.com/image.jpg"
        assert result.brand == "Brand Name"


class TestTryExtract:
    """Tests for the extraction pipeline with fixture HTML."""

    def test_extracts_mejuri_with_jsonld(self) -> None:
        """Extract Mejuri product using JSON-LD strategy."""
        html = load_fixture("mejuri_product.html")
        strategies = [JsonLdStrategy(), OpenGraphStrategy(), MicrodataStrategy()]

        result, method = _try_extract(html, "https://mejuri.com/product", strategies)

        assert result is not None
        assert method == "json-ld"
        assert result.title == "Diamond Bezel Necklace - London Blue Topaz"
        assert result.price_cents == 6800

    def test_extracts_sephora_merges_strategies(self) -> None:
        """Extract Sephora product merging multiple strategies."""
        html = load_fixture("sephora_product.html")
        strategies = [JsonLdStrategy(), OpenGraphStrategy(), MicrodataStrategy()]

        result, method = _try_extract(
            html, "https://www.sephora.com/product", strategies
        )

        assert result is not None
        # OpenGraph should be the first successful strategy (no JSON-LD in this fixture)
        assert method == "opengraph"

    def test_returns_none_for_garbage_extraction(self) -> None:
        """Return None when extraction produces garbage data."""
        # Create HTML that extracts to a garbage title
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>sephora.com</title>
        </head>
        <body></body>
        </html>
        """
        strategies = [JsonLdStrategy(), OpenGraphStrategy()]

        result, method = _try_extract(
            html, "https://www.sephora.com/product", strategies
        )

        # Should reject garbage title
        assert result is None
        assert method is None


class TestParseUrlWithFixtures:
    """Tests for the full parse_url pipeline using mocked fetches."""

    @pytest.mark.asyncio
    async def test_parses_mejuri_product(self) -> None:
        """Parse Mejuri URL with mocked fetch returning fixture HTML."""
        html = load_fixture("mejuri_product.html")

        with patch(
            "app.features.url_parser.service._fetch_httpx",
            new_callable=AsyncMock,
            return_value=served(html, "https://mejuri.com/shop/products/necklace"),
        ):
            result, method = await parse_url(
                "https://mejuri.com/shop/products/necklace"
            )

        assert result.title == "Diamond Bezel Necklace - London Blue Topaz"
        assert result.brand == "Mejuri"
        assert result.price_cents == 6800
        assert method == "json-ld"

    @pytest.mark.asyncio
    async def test_parses_sephora_product(self) -> None:
        """Parse Sephora URL with mocked curl_cffi fetch."""
        html = load_fixture("sephora_product.html")

        # Sephora prefers impersonation, so curl_cffi is tried first
        with (
            patch(
                "app.features.url_parser.service._fetch_curl_cffi",
                new_callable=AsyncMock,
                return_value=served(html, "https://www.sephora.com/product/blush"),
            ),
            patch(
                "app.features.url_parser.service._fetch_httpx",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result, method = await parse_url("https://www.sephora.com/product/blush")

        assert "Soft Pinch" in (result.title or "")
        assert result.price_cents == 2300

    @pytest.mark.asyncio
    async def test_parses_netaporter_product_group(self) -> None:
        """Parse Net-a-Porter URL with ProductGroup JSON-LD."""
        html = load_fixture("netaporter_product.html")

        with (
            patch(
                "app.features.url_parser.service._fetch_curl_cffi",
                new_callable=AsyncMock,
                return_value=served(
                    html, "https://www.net-a-porter.com/en-us/shop/product/dress"
                ),
            ),
            patch(
                "app.features.url_parser.service._fetch_httpx",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result, method = await parse_url(
                "https://www.net-a-porter.com/en-us/shop/product/dress"
            )

        assert "Dusk" in (result.title or "")
        assert result.brand == "REFORMATION"
        assert result.price_cents == 21800
        assert method == "json-ld"

    @pytest.mark.asyncio
    async def test_falls_back_through_fetch_methods(self) -> None:
        """Fall back to next fetch method when first returns None."""
        html = load_fixture("mejuri_product.html")

        with (
            patch(
                "app.features.url_parser.service._fetch_httpx",
                new_callable=AsyncMock,
                return_value=None,  # First method fails
            ),
            patch(
                "app.features.url_parser.service._fetch_curl_cffi",
                new_callable=AsyncMock,
                return_value=served(html),  # Second method succeeds
            ),
        ):
            result, method = await parse_url("https://example.com/product")

        assert result.title is not None

    @pytest.mark.asyncio
    async def test_raises_parse_error_when_all_methods_fail(self) -> None:
        """Raise ParseError when all fetch methods fail."""
        with (
            patch(
                "app.features.url_parser.service._fetch_httpx",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.features.url_parser.service._fetch_curl_cffi",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.features.url_parser.service._fetch_flaresolverr",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "app.features.url_parser.service._fetch_google_cache",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            with pytest.raises(ParseError) as exc_info:
                await parse_url("https://example.com/product")

        assert "All fetch methods failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_skips_challenge_pages(self) -> None:
        """Skip fetch methods that return challenge pages."""
        challenge_html = "<html>captcha-delivery.com challenge</html>"
        good_html = load_fixture("mejuri_product.html")

        with (
            patch(
                "app.features.url_parser.service._fetch_httpx",
                new_callable=AsyncMock,
                return_value=served(challenge_html),  # Returns challenge page
            ),
            patch(
                "app.features.url_parser.service._fetch_curl_cffi",
                new_callable=AsyncMock,
                return_value=served(good_html),  # Returns good HTML
            ),
        ):
            result, _ = await parse_url("https://example.com/product")

        # Should use curl_cffi result, not challenge page
        assert result.title == "Diamond Bezel Necklace - London Blue Topaz"

    @pytest.mark.asyncio
    async def test_strips_tracking_params(self) -> None:
        """Verify tracking params are stripped from URL before fetching."""
        html = load_fixture("mejuri_product.html")

        with patch(
            "app.features.url_parser.service._fetch_httpx",
            new_callable=AsyncMock,
            return_value=served(html, "https://mejuri.com/product"),
        ) as mock_fetch:
            await parse_url(
                "https://mejuri.com/product?utm_source=google&utm_medium=cpc"
            )

        # Verify fetch was called with cleaned URL
        call_args = mock_fetch.call_args[0]
        assert "utm_source" not in call_args[0]
        assert "utm_medium" not in call_args[0]
