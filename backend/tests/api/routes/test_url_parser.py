"""Tests for the URL parsing endpoint.

Community-themed tests for the Study Group's wishlist needs.
"""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.core.config import settings
from app.features.url_parser.service import FetchError
from app.features.url_parser.strategies import (
    EmbeddedJsonStrategy,
    JsonLdStrategy,
    OpenGraphStrategy,
    parse_price_to_cents,
)

# Sample HTML with JSON-LD Product schema (like Mejuri)
SAMPLE_HTML_JSON_LD = """
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Variant Name",
        "isVariantOf": {
            "@type": "ProductGroup",
            "name": "Hawthorne Ring"
        },
        "image": "https://example.com/ring.jpg",
        "description": "A beautiful ring for study group members",
        "offers": {
            "@type": "Offer",
            "price": "299.00",
            "priceCurrency": "USD"
        }
    }
    </script>
</head>
<body></body>
</html>
"""

# Sample HTML with OpenGraph tags only
SAMPLE_HTML_OPENGRAPH = """
<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="Troy's Awesome Jacket">
    <meta property="og:description" content="The jacket that makes you cool. Cool cool cool.">
    <meta property="og:image" content="https://example.com/jacket.jpg">
    <meta property="og:price:amount" content="150.00">
    <meta property="og:price:currency" content="USD">
</head>
<body></body>
</html>
"""

# Sample HTML with no structured data
SAMPLE_HTML_NO_DATA = """
<!DOCTYPE html>
<html>
<head><title>Just a page</title></head>
<body><h1>No product here</h1></body>
</html>
"""

# Sample HTML with ProductGroup (Net-a-Porter style)
SAMPLE_HTML_PRODUCT_GROUP = """
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "ProductGroup",
        "name": "Brigitte embellished suede tote",
        "description": "A luxurious tote for the Dean's office",
        "hasVariant": [
            {
                "@type": "Product",
                "offers": {
                    "@type": "Offer",
                    "price": "3000.00",
                    "priceCurrency": "USD"
                },
                "image": "https://example.com/tote.jpg"
            }
        ]
    }
    </script>
</head>
<body></body>
</html>
"""

# Sample HTML with og:titles typo (Net-a-Porter style)
SAMPLE_HTML_OG_TITLES_TYPO = """
<!DOCTYPE html>
<html>
<head>
    <meta property="og:type" content="product">
    <meta property="og:titles" content="Britta's Backpack | Greendale Store">
    <meta property="og:description" content="The bag that says 'I'm not like other bags'">
    <meta property="og:image" content="https://example.com/backpack.jpg">
</head>
<body></body>
</html>
"""

# Sample HTML with embedded JSON price (Net-a-Porter style)
SAMPLE_HTML_EMBEDDED_JSON = """
<!DOCTYPE html>
<html>
<head><title>Product</title></head>
<body>
<script>
window.__INITIAL_STATE__ = {
    "product": {
        "sellingPrice": {"amount": 150000, "currency": "USD"},
        "fullPrice": {"amount": 200000, "currency": "USD"}
    }
};
</script>
</body>
</html>
"""


class TestPriceParser:
    """Tests for price string parsing. Jeff Winger would appreciate the precision."""

    def test_parse_simple_price(self) -> None:
        cents, currency = parse_price_to_cents("68.00", "USD")
        assert cents == 6800
        assert currency == "USD"

    def test_parse_price_with_symbol(self) -> None:
        cents, currency = parse_price_to_cents("$299.99", None)
        assert cents == 29999

    def test_parse_price_with_commas(self) -> None:
        cents, currency = parse_price_to_cents("1,299.00", "USD")
        assert cents == 129900

    def test_parse_price_no_decimals(self) -> None:
        cents, currency = parse_price_to_cents("50", "EUR")
        assert cents == 5000
        assert currency == "EUR"

    def test_parse_price_none(self) -> None:
        cents, currency = parse_price_to_cents(None, None)
        assert cents is None

    def test_parse_price_invalid(self) -> None:
        cents, currency = parse_price_to_cents("not a price", None)
        assert cents is None


class TestJsonLdStrategy:
    """Tests for JSON-LD extraction. Annie would organize these perfectly."""

    def test_extract_product_from_json_ld(self) -> None:
        strategy = JsonLdStrategy()
        result = strategy.extract(SAMPLE_HTML_JSON_LD, "https://example.com/product")

        assert result is not None
        assert result.title == "Hawthorne Ring"  # Uses isVariantOf.name
        assert result.image_url == "https://example.com/ring.jpg"
        assert result.price_cents == 29900
        assert result.currency == "USD"
        assert result.description == "A beautiful ring for study group members"

    def test_no_product_in_json_ld(self) -> None:
        strategy = JsonLdStrategy()
        result = strategy.extract(SAMPLE_HTML_NO_DATA, "https://example.com")
        assert result is None


class TestOpenGraphStrategy:
    """Tests for OpenGraph extraction. Abed would appreciate the metadata."""

    def test_extract_from_opengraph(self) -> None:
        strategy = OpenGraphStrategy()
        result = strategy.extract(SAMPLE_HTML_OPENGRAPH, "https://example.com/jacket")

        assert result is not None
        assert result.title == "Troy's Awesome Jacket"
        assert result.description == "The jacket that makes you cool. Cool cool cool."
        assert result.image_url == "https://example.com/jacket.jpg"
        assert result.price_cents == 15000
        assert result.currency == "USD"

    def test_no_opengraph_data(self) -> None:
        strategy = OpenGraphStrategy()
        result = strategy.extract(SAMPLE_HTML_NO_DATA, "https://example.com")
        assert result is None

    def test_extract_from_opengraph_titles_typo(self) -> None:
        """Net-a-Porter uses og:titles instead of og:title. Streets ahead!"""
        strategy = OpenGraphStrategy()
        result = strategy.extract(
            SAMPLE_HTML_OG_TITLES_TYPO, "https://example.com/backpack"
        )

        assert result is not None
        # Title should be cleaned (remove site suffix)
        assert result.title == "Britta's Backpack"
        assert result.description == "The bag that says 'I'm not like other bags'"
        assert result.image_url == "https://example.com/backpack.jpg"


class TestProductGroupExtraction:
    """Tests for ProductGroup JSON-LD extraction. Net-a-Porter style, very Chang."""

    def test_extract_product_group(self) -> None:
        strategy = JsonLdStrategy()
        result = strategy.extract(SAMPLE_HTML_PRODUCT_GROUP, "https://example.com/tote")

        assert result is not None
        assert result.title == "Brigitte embellished suede tote"
        assert result.description == "A luxurious tote for the Dean's office"
        assert result.image_url == "https://example.com/tote.jpg"
        assert result.price_cents == 300000
        assert result.currency == "USD"


class TestEmbeddedJsonStrategy:
    """Tests for embedded JSON price extraction. Pierce would pay full price."""

    def test_extract_selling_price(self) -> None:
        strategy = EmbeddedJsonStrategy()
        result = strategy.extract(
            SAMPLE_HTML_EMBEDDED_JSON, "https://example.com/product"
        )

        assert result is not None
        assert result.price_cents == 150000
        assert result.currency == "USD"
        # This strategy only extracts price
        assert result.title is None
        assert result.image_url is None

    def test_no_embedded_price(self) -> None:
        strategy = EmbeddedJsonStrategy()
        result = strategy.extract(SAMPLE_HTML_NO_DATA, "https://example.com")
        assert result is None


class TestUrlParserEndpoint:
    """Tests for the /url-parser/parse endpoint. The Dean would be proud."""

    def test_parse_url_requires_auth(self, client: TestClient) -> None:
        """Unauthenticated requests should be rejected."""
        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://example.com/product"},
        )
        assert response.status_code == 401

    @patch("app.features.url_parser.router.parse_url")
    def test_parse_url_success(
        self,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Successfully parse a product URL with JSON-LD data."""
        from app.features.url_parser.models import ProductMetadata

        mock_parse_url.return_value = (
            ProductMetadata(
                title="Hawthorne Ring",
                description="A beautiful ring for study group members",
                image_url="https://example.com/ring.jpg",
                price_cents=29900,
                currency="USD",
                source_url="https://mejuri.com/products/hawthorne-ring",
            ),
            "json-ld",
        )

        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://mejuri.com/products/hawthorne-ring"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Hawthorne Ring"
        assert data["price_cents"] == 29900
        assert data["currency"] == "USD"
        assert data["extraction_method"] == "json-ld"

    @patch("app.features.url_parser.router.parse_url")
    def test_parse_url_opengraph_fallback(
        self,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Fall back to OpenGraph when JSON-LD is not available."""
        from app.features.url_parser.models import ProductMetadata

        mock_parse_url.return_value = (
            ProductMetadata(
                title="Troy's Awesome Jacket",
                description="The jacket that makes you cool. Cool cool cool.",
                image_url="https://example.com/jacket.jpg",
                price_cents=15000,
                currency="USD",
                source_url="https://example.com/jacket",
            ),
            "opengraph",
        )

        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://example.com/jacket"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Troy's Awesome Jacket"
        assert data["extraction_method"] == "opengraph"

    @patch("app.features.url_parser.router.parse_url")
    def test_parse_url_no_data_returns_empty(
        self,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Return empty response when no structured data found."""
        from app.features.url_parser.models import ProductMetadata

        # When no data is found, parse_url still returns metadata with None fields
        mock_parse_url.return_value = (
            ProductMetadata(
                title=None,
                description=None,
                image_url=None,
                price_cents=None,
                currency=None,
                source_url="https://example.com/page",
            ),
            None,
        )

        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://example.com/page"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] is None
        assert data["extraction_method"] is None

    @patch("app.features.url_parser.router.parse_url")
    def test_parse_url_blocked_site(
        self,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Return 422 when site blocks the request."""
        mock_parse_url.side_effect = FetchError(
            "https://sephora.com", status_code=403, message="Forbidden"
        )

        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://sephora.com/product/something"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 422
        assert "blocks automated requests" in response.json()["detail"]

    @patch("app.features.url_parser.router.parse_url")
    def test_parse_url_not_found(
        self,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Return 404 when product page not found."""
        mock_parse_url.side_effect = FetchError(
            "https://example.com/gone", status_code=404, message="Not Found"
        )

        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "https://example.com/gone"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_parse_url_invalid_url(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        """Reject invalid URLs."""
        response = client.post(
            f"{settings.API_V1_STR}/url-parser/parse",
            json={"url": "not-a-valid-url"},
            headers=superuser_token_headers,
        )

        assert response.status_code == 422  # Validation error
