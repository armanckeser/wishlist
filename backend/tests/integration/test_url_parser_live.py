"""Integration tests for URL parser against real websites.

These tests hit REAL product pages - they're meant to be run manually,
not in CI, since they depend on external sites being up and unchanged.

Run with: FLARESOLVERR_URL="http://localhost:8191/v1" uv run pytest tests/integration/test_url_parser_live.py -v

The Greendale Study Group would approve of these thorough tests.
"""

import asyncio
from dataclasses import dataclass

import pytest

from app.features.url_parser.service import FetchError, parse_url


@dataclass
class SiteTestCase:
    """A test case for a specific product URL."""

    name: str
    url: str
    expected_title_contains: str
    expected_min_price_cents: int
    expected_max_price_cents: int


# Known product URLs for testing
# Update these if products go out of stock or URLs change
SITE_TEST_CASES = [
    # === Shopify sites (httpx works) ===
    SiteTestCase(
        name="Mejuri",
        url="https://mejuri.com/products/charlotte-trinket-box?Material=PVD+Stainless+Steel",
        expected_title_contains="Trinket",
        expected_min_price_cents=5000,
        expected_max_price_cents=15000,
    ),
    SiteTestCase(
        name="The Row",
        url="https://www.therow.com/products/mumu-tights-grey-1",
        expected_title_contains="Tights",
        expected_min_price_cents=80000,
        expected_max_price_cents=150000,
    ),
    SiteTestCase(
        name="idyl",
        url="https://idyl.com/collections/necklaces/products/lena",
        expected_title_contains="Lena",
        expected_min_price_cents=50000,
        expected_max_price_cents=100000,
    ),
    # === TLS fingerprinting bypass (curl_cffi) ===
    SiteTestCase(
        name="Net-a-Porter",
        url="https://www.net-a-porter.com/en-us/shop/product/magda-butrym/bags/shoulder-bags/brigitte-embellished-suede-tote/46376663162981101",
        expected_title_contains="Brigitte",
        expected_min_price_cents=200000,
        expected_max_price_cents=400000,
    ),
    SiteTestCase(
        name="Sephora",
        url="https://www.sephora.com/product/chloe-l-eau-de-parfum-lumineuse-eau-de-parfum-P509015?skuId=2695062",
        expected_title_contains="Chloé",
        expected_min_price_cents=15000,
        expected_max_price_cents=25000,
    ),
    SiteTestCase(
        name="Max Mara",
        url="https://us.maxmara.com/p-5016085206026-tempera-camel",
        expected_title_contains="coat",
        expected_min_price_cents=50000,
        expected_max_price_cents=500000,
    ),
    # NOTE: Hermes is flaky - sometimes works with curl_cffi, sometimes blocked
    # by DataDome. Skip if it fails with challenge error.
    SiteTestCase(
        name="Hermes",
        url="https://www.hermes.com/us/en/product/kelly-18-belt-H069853CC89/",
        expected_title_contains="Kelly",
        expected_min_price_cents=50000,
        expected_max_price_cents=300000,
    ),
    # === Automatic fallback to curl_cffi (403 from httpx) ===
    SiteTestCase(
        name="Babaa",
        url="https://babaa.es/shop/women/cardigans/cardigan-woman-no23-oak/",
        expected_title_contains="cardigan",
        expected_min_price_cents=20000,
        expected_max_price_cents=35000,
    ),
    SiteTestCase(
        name="Francis Kurkdjian",
        url="https://www.franciskurkdjian.com/us-en/p/gentle-fluidity-gold-edition---eau-de-parfum-RA122881.html",
        expected_title_contains="Fluidity",
        expected_min_price_cents=10000,
        expected_max_price_cents=25000,
    ),
    # === FlareSolverr needed (JS challenge) ===
    SiteTestCase(
        name="Stylevana",
        url="https://www.stylevana.com/en_US/dr-ceuracle-vegan-kombucha-tea-essence-150ml24420.html",
        expected_title_contains="Kombucha",
        expected_min_price_cents=1500,
        expected_max_price_cents=4000,
    ),
    # === HTML fallback (no structured data) ===
    SiteTestCase(
        name="Amazon",
        url="https://amazon.com/Amazon-Kindle-Scribe/dp/B0CZ9TDDN6/",
        expected_title_contains="Kindle",
        expected_min_price_cents=25000,
        expected_max_price_cents=40000,
    ),
    # === New sites to test ===
    SiteTestCase(
        name="Revolve",
        url="https://www.revolve.com/mobile/eaves-kaie-convertible-cardigan-in-taupe/dp/EAVR-WK39/",
        expected_title_contains="Cardigan",
        expected_min_price_cents=15000,
        expected_max_price_cents=30000,
    ),
    SiteTestCase(
        name="Elemis",
        url="https://us.elemis.com/superfood-glow-cleansing-butter-90ml.html?bottle_size=349&tw_source=google&tw_adid=&tw_campaign=19621076798&tw_kwdid=&gad_source=1&gad_campaignid=19620979654&gbraid=0AAAAADR4dkjDEqj0r45xDgqNu5kg4bnMJ&gclid=Cj0KCQiApfjKBhC0ARIsAMiR_ItzP70BKz3htSXAUzGc1Ur3Ls9z4hvcm9qFC9a62N8L5ZxdzAwIO8caAgq8EALw_wcB",
        expected_title_contains="Superfood",
        expected_min_price_cents=2000,
        expected_max_price_cents=8000,
    ),
]

# Sites that were previously blocked but now work via Google Cache fallback
# Keeping this list for documentation - these sites have aggressive bot protection
# but our fallback chain (including Google Cache) can handle them now
PREVIOUSLY_BLOCKED_SITES = [
    # Bergdorf Goodman - works via Google Cache + html-fallback extraction
    "https://www.bergdorfgoodman.com/p/dries-van-noten-mixed-leather-retro-runner-sneakers-prod185350232",
]

# Sites that are truly blocked (no fetch method works, including Google Cache)
BLOCKED_SITES: list[tuple[str, str]] = [
    # Currently empty - Google Cache fallback handles most previously-blocked sites
]


def _run_async(coro):
    """Helper to run async code in sync test."""
    return asyncio.run(coro)


@pytest.mark.integration
class TestUrlParserLive:
    """Integration tests against real product pages."""

    @pytest.mark.parametrize(
        "test_case",
        SITE_TEST_CASES,
        ids=[tc.name for tc in SITE_TEST_CASES],
    )
    def test_parse_product_url(self, test_case: SiteTestCase) -> None:
        """Test fetching and parsing a real product page.

        The service handles all fetch logic (httpx, curl_cffi, FlareSolverr).
        Tests skip gracefully if FlareSolverr is needed but unavailable.
        """
        from app.features.url_parser.service import ParseError

        try:
            metadata, method = _run_async(parse_url(test_case.url))
        except FetchError as e:
            if "FlareSolverr" in str(e):
                pytest.skip(f"FlareSolverr unavailable: {e}")
            pytest.fail(f"Failed to fetch {test_case.name}: {e}")
        except ParseError as e:
            # Some sites (like Hermes) are flaky with bot detection
            if "challenge" in str(e).lower():
                pytest.skip(f"Bot detection challenge (flaky): {e}")
            pytest.fail(f"Failed to parse {test_case.name}: {e}")

        # Title check
        assert metadata.title is not None, f"{test_case.name}: No title"
        assert test_case.expected_title_contains.lower() in metadata.title.lower(), (
            f"{test_case.name}: Expected title containing "
            f"'{test_case.expected_title_contains}', got '{metadata.title}'"
        )

        # Price range check
        assert metadata.price_cents is not None, f"{test_case.name}: No price"
        assert metadata.price_cents >= test_case.expected_min_price_cents, (
            f"{test_case.name}: Price {metadata.price_cents} below minimum "
            f"{test_case.expected_min_price_cents}"
        )
        assert metadata.price_cents <= test_case.expected_max_price_cents, (
            f"{test_case.name}: Price {metadata.price_cents} above maximum "
            f"{test_case.expected_max_price_cents}"
        )

        # Image check
        assert metadata.image_url is not None, f"{test_case.name}: No image URL"
        assert metadata.image_url.startswith(
            "http"
        ), f"{test_case.name}: Invalid image URL: {metadata.image_url}"

    @pytest.mark.parametrize(
        "name,url",
        BLOCKED_SITES
        if BLOCKED_SITES
        else [pytest.param("skip", "skip", marks=pytest.mark.skip)],
        ids=[site[0] for site in BLOCKED_SITES]
        if BLOCKED_SITES
        else ["no_blocked_sites"],
    )
    def test_blocked_sites_fail_gracefully(self, name: str, url: str) -> None:
        """Test that truly blocked sites fail gracefully.

        Note: Most previously-blocked sites (like Bergdorf Goodman) now work
        via Google Cache fallback. This test is for sites that can't be fetched
        by any method.
        """
        if not BLOCKED_SITES:
            pytest.skip("No blocked sites to test - Google Cache handles most cases")

        from app.features.url_parser.service import ParseError

        with pytest.raises(ParseError) as exc_info:
            _run_async(parse_url(url))

        assert (
            "failed" in str(exc_info.value).lower()
        ), f"{name}: Expected failure error, got: {exc_info.value}"
