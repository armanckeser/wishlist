"""Tests for product identity verification (no network, no DB)."""

from app.features.price_tracking.models import PriceCheckFailureReason
from app.features.price_tracking.verification import (
    is_listing_url,
    landed_elsewhere,
    slug_text,
    title_similarity,
    verify_identity,
)

URL = "https://www.mejuri.com/shop/products/kensington-ring"
TITLE = "Kensington Ring"


def check(
    title: str | None = TITLE,
    final_url: str | None = URL,
    *,
    product_url: str = URL,
    item_title: str | None = None,
    verified_title: str | None = None,
):
    """Run one verification against the page a fetch came back with."""
    return verify_identity(
        product_url=product_url,
        final_url=final_url,
        page_title=title,
        item_title=item_title,
        verified_title=verified_title,
    )


class TestUrlHelpers:
    def test_same_url_did_not_move(self) -> None:
        assert not landed_elsewhere(URL, URL)

    def test_query_and_fragment_changes_are_not_a_move(self) -> None:
        assert not landed_elsewhere(URL, f"{URL}?variant=14k#details")

    def test_trailing_slash_and_locale_prefix_are_not_a_move(self) -> None:
        assert not landed_elsewhere(URL, f"{URL}/")
        assert not landed_elsewhere(
            URL, "https://www.mejuri.com/en/shop/products/kensington-ring"
        )

    def test_market_routing_is_not_a_move(self) -> None:
        assert not landed_elsewhere(
            URL, "https://www.mejuri.com/us/en/shop/products/kensington-ring"
        )

    def test_www_is_not_a_move(self) -> None:
        assert not landed_elsewhere(URL, URL.replace("www.", ""))

    def test_different_path_is_a_move(self) -> None:
        assert landed_elsewhere(URL, "https://www.mejuri.com/collections/rings")

    def test_different_host_is_a_move(self) -> None:
        assert landed_elsewhere(URL, "https://www.example.com/shop/products/ring")

    def test_listing_urls(self) -> None:
        assert is_listing_url("https://www.mejuri.com/")
        assert is_listing_url("https://www.mejuri.com/collections/rings")
        assert is_listing_url("https://www.mejuri.com/search?q=ring")
        assert not is_listing_url(URL)

    def test_slug_text(self) -> None:
        assert slug_text(URL) == "kensington ring"
        assert slug_text("https://shop.com/p/12345") == "p"
        assert slug_text("https://shop.com/gold-hoops.html") == "gold hoops"


class TestTitleSimilarity:
    def test_site_suffix_still_matches(self) -> None:
        score = title_similarity(TITLE, "Kensington Ring | Mejuri")
        assert score == 1.0

    def test_unrelated_titles_do_not_match(self) -> None:
        score = title_similarity(TITLE, "Chunky Chain Necklace")
        assert score == 0.0

    def test_missing_title_has_no_score(self) -> None:
        assert title_similarity(TITLE, None) is None


class TestVerifyIdentity:
    def test_same_page_same_title_is_accepted(self) -> None:
        assert check(item_title=TITLE).ok

    def test_redirect_to_a_listing_is_rejected(self) -> None:
        verdict = check(
            "Rings | Mejuri",
            "https://www.mejuri.com/collections/rings",
            item_title=TITLE,
        )
        assert not verdict.ok
        assert verdict.reason == PriceCheckFailureReason.LINK_MOVED
        assert "product list" in (verdict.detail or "")

    def test_redirect_to_the_same_product_is_accepted(self) -> None:
        """Stores do move products to new URLs - that is not a broken link."""
        verdict = check(
            "Kensington Ring | Mejuri",
            "https://www.mejuri.com/shop/products/kensington-ring-14k",
            item_title=TITLE,
        )
        assert verdict.ok

    def test_same_url_serving_another_product_is_rejected(self) -> None:
        verdict = check(
            "Croissant Dôme Necklace", item_title=TITLE, verified_title=TITLE
        )
        assert not verdict.ok
        assert verdict.reason == PriceCheckFailureReason.DIFFERENT_PRODUCT

    def test_renamed_item_is_not_mistaken_for_another_product(self) -> None:
        """The owner's own title is weak evidence - the slug still matches."""
        verdict = check(
            "Kensington Ring | Mejuri", item_title="birthday present for mum"
        )
        assert verdict.ok

    def test_no_page_title_on_an_unmoved_link_is_accepted(self) -> None:
        verdict = check(None, item_title=TITLE)
        assert verdict.ok

    def test_verified_title_beats_a_renamed_item(self) -> None:
        verdict = check(
            "Kensington Ring",
            "https://shop.com/p/12345",
            product_url="https://shop.com/p/12345",
            item_title="present",
            verified_title="Kensington Ring",
        )
        assert verdict.ok
