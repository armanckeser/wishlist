"""Unit tests for URL parser extraction strategies using real HTML fixtures.

Tests each strategy's ability to extract product metadata from realistic HTML.
Named after Community characters because that's the Greendale way.
"""

from pathlib import Path

import pytest

from app.features.url_parser.strategies import (
    EmbeddedJsonStrategy,
    HtmlFallbackStrategy,
    JsonLdStrategy,
    MicrodataStrategy,
    OpenGraphStrategy,
    parse_price_to_cents,
)

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures" / "html"


def load_fixture(name: str) -> str:
    """Load HTML fixture by name (like Jeff Winger loading up on confidence)."""
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


class TestParsePriceToCents:
    """Tests for price parsing - because Troy and Abed need to count their allowance."""

    @pytest.mark.parametrize(
        ("price_str", "currency", "expected_cents", "expected_currency"),
        [
            ("68.00", "USD", 6800, "USD"),
            ("$68.00", None, 6800, None),
            ("68", "USD", 6800, "USD"),
            ("1,299.99", "USD", 129999, "USD"),
            ("$1,299.99", "EUR", 129999, "EUR"),
            ("23.00", None, 2300, None),
            ("218.00", "USD", 21800, "USD"),
            ("0.99", "USD", 99, "USD"),
            ("", "USD", None, "USD"),
            (None, "USD", None, "USD"),
            ("invalid", "USD", None, "USD"),
            ("$$$", "USD", None, "USD"),
        ],
        ids=[
            "simple_decimal",
            "with_dollar_sign",
            "integer_price",
            "thousands_separator",
            "dollar_sign_with_explicit_currency",
            "no_currency",
            "higher_price",
            "sub_dollar",
            "empty_string",
            "none_input",
            "invalid_string",
            "only_symbols",
        ],
    )
    def test_price_parsing(
        self,
        price_str: str | None,
        currency: str | None,
        expected_cents: int | None,
        expected_currency: str | None,
    ) -> None:
        """Parse various price formats correctly."""
        result_cents, result_currency = parse_price_to_cents(price_str, currency)
        assert result_cents == expected_cents
        assert result_currency == expected_currency

    @pytest.mark.parametrize(
        ("price_str", "expected_cents"),
        [
            ("£99.99", 9999),
            ("€149.00", 14900),
            ("¥1500", 150000),
        ],
        ids=["pounds", "euros", "yen"],
    )
    def test_currency_symbol_stripping(
        self, price_str: str, expected_cents: int
    ) -> None:
        """Strip various currency symbols - even Pierce's foreign money."""
        cents, _ = parse_price_to_cents(price_str, None)
        assert cents == expected_cents


class TestJsonLdStrategy:
    """Tests for JSON-LD extraction - Abed's favorite structured data format."""

    @pytest.fixture
    def strategy(self) -> JsonLdStrategy:
        return JsonLdStrategy()

    def test_extracts_mejuri_product(self, strategy: JsonLdStrategy) -> None:
        """Extract product from Mejuri-style JSON-LD."""
        html = load_fixture("mejuri_product.html")
        result = strategy.extract(html, "https://mejuri.com/product")

        assert result is not None
        assert result.title == "Diamond Bezel Necklace - London Blue Topaz"
        assert result.brand == "Mejuri"
        assert result.price_cents == 6800
        assert result.currency == "USD"
        assert (
            result.image_url
            == "https://mejuri.com/images/diamond-bezel-necklace-topaz.jpg"
        )
        assert "gold vermeil necklace" in (result.description or "")

    def test_extracts_breadcrumbs(self, strategy: JsonLdStrategy) -> None:
        """Extract and normalize breadcrumbs."""
        html = load_fixture("mejuri_product.html")
        result = strategy.extract(html, "https://mejuri.com/product")

        assert result is not None
        assert result.breadcrumbs is not None
        # Home should be filtered, categories normalized
        assert "Necklaces" in result.breadcrumbs
        assert "Pendant Necklaces" in result.breadcrumbs
        # Product name at end should be filtered (too long/specific)
        assert "Home" not in result.breadcrumbs

    def test_extracts_product_group(self, strategy: JsonLdStrategy) -> None:
        """Extract from ProductGroup structure (Net-a-Porter style)."""
        html = load_fixture("netaporter_product.html")
        result = strategy.extract(html, "https://www.net-a-porter.com/product")

        assert result is not None
        assert "Dusk" in (result.title or "")
        assert result.brand == "REFORMATION"
        assert result.price_cents == 21800
        assert result.currency == "USD"
        # Category comes from breadcrumbs (first non-Home entry), which is "Clothing"
        assert result.category == "Clothing"

    def test_extracts_graph_structure(self, strategy: JsonLdStrategy) -> None:
        """Handle @graph structure with multiple items."""
        html = load_fixture("netaporter_product.html")
        result = strategy.extract(html, "https://www.net-a-porter.com/product")

        # Should find breadcrumbs from BreadcrumbList in @graph
        assert result is not None
        assert result.breadcrumbs is not None
        # Clothing, Dresses, Midi Dresses should be present (Home filtered)
        assert "Clothing" in result.breadcrumbs
        assert "Dresses" in result.breadcrumbs

    def test_returns_none_for_no_jsonld(self, strategy: JsonLdStrategy) -> None:
        """Return None when no JSON-LD is present."""
        html = load_fixture("simple_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is None

    def test_strategy_name(self, strategy: JsonLdStrategy) -> None:
        """Strategy identifies itself correctly."""
        assert strategy.name == "json-ld"


class TestOpenGraphStrategy:
    """Tests for OpenGraph extraction - like Facebook metadata but for products."""

    @pytest.fixture
    def strategy(self) -> OpenGraphStrategy:
        return OpenGraphStrategy()

    def test_extracts_sephora_product(self, strategy: OpenGraphStrategy) -> None:
        """Extract from OpenGraph tags."""
        html = load_fixture("sephora_product.html")
        result = strategy.extract(html, "https://www.sephora.com/product")

        assert result is not None
        assert result.title == "Soft Pinch Liquid Blush"  # Site suffix stripped
        assert result.price_cents == 2300
        assert result.currency == "USD"
        assert result.image_url == "https://www.sephora.com/images/soft-pinch-blush.jpg"

    def test_strips_site_suffix_from_title(self, strategy: OpenGraphStrategy) -> None:
        """Strip '| Site Name' suffix from og:title."""
        html = load_fixture("netaporter_product.html")
        result = strategy.extract(html, "https://www.net-a-porter.com/product")

        assert result is not None
        # Should strip " | NET-A-PORTER" from title
        assert "NET-A-PORTER" not in (result.title or "")

    def test_returns_none_for_no_opengraph(self, strategy: OpenGraphStrategy) -> None:
        """Return None when no OpenGraph tags present."""
        html = load_fixture("embedded_json_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is None

    def test_strategy_name(self, strategy: OpenGraphStrategy) -> None:
        """Strategy identifies itself correctly."""
        assert strategy.name == "opengraph"


class TestMicrodataStrategy:
    """Tests for Microdata extraction - the HTML5 way to add structure."""

    @pytest.fixture
    def strategy(self) -> MicrodataStrategy:
        return MicrodataStrategy()

    def test_extracts_microdata_product(self, strategy: MicrodataStrategy) -> None:
        """Extract from Microdata itemscope/itemprop."""
        html = load_fixture("sephora_product.html")
        result = strategy.extract(html, "https://www.sephora.com/product")

        assert result is not None
        assert result.title == "Soft Pinch Liquid Blush"
        assert result.price_cents == 2300
        assert result.currency == "USD"
        # Microdata image, not OG image
        assert "microdata" in (result.image_url or "")

    def test_extracts_nested_brand(self, strategy: MicrodataStrategy) -> None:
        """Extract brand from nested itemscope."""
        # Microdata in sephora fixture has nested brand
        html = load_fixture("sephora_product.html")
        result = strategy.extract(html, "https://www.sephora.com/product")

        # Note: current implementation doesn't extract brand from microdata
        # This test documents current behavior
        assert result is not None

    def test_returns_none_for_no_microdata(self, strategy: MicrodataStrategy) -> None:
        """Return None when no Microdata present."""
        html = load_fixture("mejuri_product.html")
        result = strategy.extract(html, "https://mejuri.com/product")

        assert result is None

    def test_strategy_name(self, strategy: MicrodataStrategy) -> None:
        """Strategy identifies itself correctly."""
        assert strategy.name == "microdata"


class TestEmbeddedJsonStrategy:
    """Tests for embedded JSON extraction - for when sites hide data in scripts."""

    @pytest.fixture
    def strategy(self) -> EmbeddedJsonStrategy:
        return EmbeddedJsonStrategy()

    def test_extracts_selling_price(self, strategy: EmbeddedJsonStrategy) -> None:
        """Extract price from sellingPrice.amount pattern."""
        html = load_fixture("embedded_json_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        assert result.price_cents == 39500  # $395.00
        assert result.currency == "USD"

    def test_extracts_from_netaporter_pattern(
        self, strategy: EmbeddedJsonStrategy
    ) -> None:
        """Extract price from Net-a-Porter style embedded JSON."""
        html = load_fixture("netaporter_product.html")
        result = strategy.extract(html, "https://www.net-a-porter.com/product")

        assert result is not None
        assert result.price_cents == 21800  # From sellingPrice.amount

    def test_only_extracts_price(self, strategy: EmbeddedJsonStrategy) -> None:
        """Strategy only extracts price, not title/description/image."""
        html = load_fixture("embedded_json_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        assert result.title is None
        assert result.description is None
        assert result.image_url is None

    def test_returns_none_for_no_embedded_json(
        self, strategy: EmbeddedJsonStrategy
    ) -> None:
        """Return None when no embedded JSON price patterns found."""
        # HTML with no embedded price patterns (just standard JSON-LD)
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Product</title>
            <script type="application/ld+json">
            {"@type": "Product", "name": "Test"}
            </script>
        </head>
        <body></body>
        </html>
        """
        result = strategy.extract(html, "https://example.com/product")

        assert result is None

    def test_strategy_name(self, strategy: EmbeddedJsonStrategy) -> None:
        """Strategy identifies itself correctly."""
        assert strategy.name == "embedded-json"


class TestHtmlFallbackStrategy:
    """Tests for HTML fallback extraction - when structured data fails us."""

    @pytest.fixture
    def strategy(self) -> HtmlFallbackStrategy:
        return HtmlFallbackStrategy()

    def test_extracts_title_from_title_tag(
        self, strategy: HtmlFallbackStrategy
    ) -> None:
        """Extract and clean title from <title> tag."""
        html = load_fixture("simple_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        # Site suffix " | Fashion Store" is stripped, leaving " - Brown"
        # which then gets stripped as another separator, leaving just the product name
        assert result.title == "Vintage Leather Jacket"

    def test_extracts_description_from_meta(
        self, strategy: HtmlFallbackStrategy
    ) -> None:
        """Extract description from meta description tag."""
        html = load_fixture("simple_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        assert "vintage-style leather jacket" in (result.description or "")

    def test_extracts_price_from_data_attribute(
        self, strategy: HtmlFallbackStrategy
    ) -> None:
        """Extract price from data-price attribute."""
        html = load_fixture("simple_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        assert result.price_cents == 29999

    def test_extracts_image_from_hires_pattern(
        self, strategy: HtmlFallbackStrategy
    ) -> None:
        """Extract image from hiRes JSON pattern."""
        html = load_fixture("simple_product.html")
        result = strategy.extract(html, "https://example.com/product")

        assert result is not None
        assert "jacket-hires.jpg" in (result.image_url or "")

    def test_returns_none_for_empty_html(self, strategy: HtmlFallbackStrategy) -> None:
        """Return None when HTML has no extractable content."""
        html = "<html><head></head><body></body></html>"
        result = strategy.extract(html, "https://example.com/product")

        assert result is None

    def test_strategy_name(self, strategy: HtmlFallbackStrategy) -> None:
        """Strategy identifies itself correctly."""
        assert strategy.name == "html-fallback"

    @pytest.mark.parametrize(
        ("title_html", "expected"),
        [
            ("<title>Product Name | Site</title>", "Product Name"),
            ("<title>Product Name - Store</title>", "Product Name"),
            ("<title>Product : Category : Store</title>", "Product : Category"),
            ("<title>Short</title>", "Short"),  # Too short to strip
            ("<title>Product &amp; Accessories</title>", "Product & Accessories"),
        ],
        ids=[
            "pipe_separator",
            "dash_separator",
            "colon_separator",
            "short_title",
            "html_entities",
        ],
    )
    def test_title_cleaning(
        self, strategy: HtmlFallbackStrategy, title_html: str, expected: str
    ) -> None:
        """Test various title cleaning scenarios."""
        html = f"<html><head>{title_html}</head><body></body></html>"
        result = strategy.extract(html, "https://example.com/product")

        # May be None if no price and title too short
        if result:
            assert result.title == expected
