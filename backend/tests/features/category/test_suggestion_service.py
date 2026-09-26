"""Tests for category suggestion service.

The Study Group at Greendale would be proud of these thorough tests
for intelligent category suggestions. Jeff Winger himself would approve
of the efficiency of suggesting categories without manual selection.
"""

import uuid
from typing import TypedDict

import pytest
from sqlmodel import Session

from app.features.category.models import Category
from app.features.category.suggestion_service import (
    SuggestionInput,
    suggest_categories,
    suggest_categories_by_breadcrumbs,
    suggest_categories_by_domain,
    suggest_categories_by_keywords,
    suggest_categories_by_title,
)
from app.features.users.models import User
from app.features.wishlist_item.models import WishlistItem


@pytest.fixture
def test_user(db: Session) -> User:
    """Create a test user (like Dean Pelton, always organizing things)."""
    # Generate unique email to avoid conflicts
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        email=f"dean.pelton.{unique_id}@greendale.edu",
        hashed_password="dalmatian",
        full_name="Craig Pelton",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def categories(db: Session, test_user: User) -> dict[str, Category]:
    """Create test categories (organized like Abed's movie collection)."""
    names = ["Skincare", "Jewelry", "Clothing", "Fragrance", "Home"]
    cats = {}
    for name in names:
        cat = Category(
            id=uuid.uuid4(),
            name=name,
            owner_id=test_user.id,
        )
        db.add(cat)
        cats[name] = cat
    db.commit()
    for cat in cats.values():
        db.refresh(cat)
    return cats


class ItemTestData(TypedDict):
    title: str
    product_url: str
    categories: list[Category]


@pytest.fixture
def items_with_categories(
    db: Session, test_user: User, categories: dict[str, Category]
) -> list[WishlistItem]:
    """Create test items with categories (like Troy's collection of action figures)."""
    items_data: list[ItemTestData] = [
        # Sephora items - mostly Skincare
        {
            "title": "The Ordinary Niacinamide",
            "product_url": "https://www.sephora.com/product/niacinamide",
            "categories": [categories["Skincare"]],
        },
        {
            "title": "Drunk Elephant Protini",
            "product_url": "https://www.sephora.com/product/protini",
            "categories": [categories["Skincare"]],
        },
        {
            "title": "Tatcha Dewy Skin Cream",
            "product_url": "https://www.sephora.com/product/dewy-skin",
            "categories": [categories["Skincare"]],
        },
        # Mejuri items - all Jewelry
        {
            "title": "Bold Chain Necklace",
            "product_url": "https://mejuri.com/products/bold-chain",
            "categories": [categories["Jewelry"]],
        },
        {
            "title": "Diamond Studs",
            "product_url": "https://mejuri.com/products/diamond-studs",
            "categories": [categories["Jewelry"]],
        },
        # Mixed items from Net-a-Porter
        {
            "title": "Reformation Dress",
            "product_url": "https://www.net-a-porter.com/product/dress",
            "categories": [categories["Clothing"]],
        },
        {
            "title": "Monica Vinader Ring",
            "product_url": "https://www.net-a-porter.com/product/ring",
            "categories": [categories["Jewelry"]],
        },
    ]

    items = []
    for data in items_data:
        item = WishlistItem(
            id=uuid.uuid4(),
            title=data["title"],
            product_url=data["product_url"],
            price_cents=5000,
            owner_id=test_user.id,
        )
        item.categories = data["categories"]
        db.add(item)
        items.append(item)

    db.commit()
    return items


class TestSuggestCategoriesByDomain:
    """Test domain-based suggestion strategy."""

    def test_suggests_category_from_domain_history(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should suggest Skincare for Sephora URLs based on history."""
        suggestions = suggest_categories_by_domain(
            db, test_user.id, "https://www.sephora.com/product/new-serum"
        )

        assert len(suggestions) > 0
        # Skincare should be top suggestion (3/3 Sephora items are Skincare)
        assert suggestions[0].category_name == "Skincare"
        assert suggestions[0].confidence == 1.0  # 100% of Sephora items
        assert suggestions[0].source == "domain_history"

    def test_suggests_jewelry_for_mejuri(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should suggest Jewelry for Mejuri URLs."""
        suggestions = suggest_categories_by_domain(
            db, test_user.id, "https://mejuri.com/products/gold-ring"
        )

        assert len(suggestions) > 0
        assert suggestions[0].category_name == "Jewelry"
        assert suggestions[0].confidence == 1.0

    def test_returns_empty_for_unknown_domain(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should return empty list for domains without history."""
        suggestions = suggest_categories_by_domain(
            db, test_user.id, "https://amazon.com/product/123"
        )

        assert suggestions == []


class TestSuggestCategoriesByTitle:
    """Test title-based suggestion strategy."""

    def test_matches_category_name_in_title(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should match category name appearing in title."""
        suggestions = suggest_categories_by_title(
            db, test_user.id, "Advanced Skincare Serum"
        )

        assert len(suggestions) > 0
        skincare = next((s for s in suggestions if s.category_name == "Skincare"), None)
        assert skincare is not None
        assert skincare.confidence >= 0.8

    def test_matches_partial_word(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should match when category is part of a word in title."""
        suggestions = suggest_categories_by_title(
            db, test_user.id, "Gold Ring with Diamond"
        )

        # "Jewelry" shouldn't match since it's not in the title
        jewelry = next((s for s in suggestions if s.category_name == "Jewelry"), None)
        assert jewelry is None

    def test_returns_empty_for_no_matches(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should return empty when no categories match."""
        suggestions = suggest_categories_by_title(
            db, test_user.id, "Random Product Name"
        )

        # No direct matches expected
        assert all(s.confidence < 0.8 for s in suggestions)


class TestSuggestCategoriesByBreadcrumbs:
    """Test breadcrumb-based suggestion strategy."""

    def test_matches_exact_breadcrumb(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should match breadcrumb exactly matching category name."""
        suggestions = suggest_categories_by_breadcrumbs(
            db, test_user.id, ["Beauty", "Skincare", "Moisturizers"]
        )

        assert len(suggestions) > 0
        skincare = next((s for s in suggestions if s.category_name == "Skincare"), None)
        assert skincare is not None
        assert skincare.confidence >= 0.9
        assert skincare.source == "breadcrumb_match"

    def test_matches_partial_breadcrumb(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should match when category appears within breadcrumb text."""
        suggestions = suggest_categories_by_breadcrumbs(
            db, test_user.id, ["Fashion", "Fine Jewelry", "Rings"]
        )

        jewelry = next((s for s in suggestions if s.category_name == "Jewelry"), None)
        assert jewelry is not None
        assert jewelry.confidence >= 0.8

    def test_returns_empty_for_no_matching_breadcrumbs(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should return empty when no breadcrumbs match categories."""
        suggestions = suggest_categories_by_breadcrumbs(
            db, test_user.id, ["Electronics", "Computers", "Laptops"]
        )

        # No matches expected for electronics categories
        assert len(suggestions) == 0


class TestSuggestCategoriesCombined:
    """Test combined suggestion functionality."""

    def test_combines_multiple_strategies(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should combine signals from domain, title, and breadcrumbs."""
        input_data = SuggestionInput(
            product_url="https://www.sephora.com/product/new",
            title="New Skincare Serum",
            breadcrumbs=["Beauty", "Skincare", "Serums"],
        )

        suggestions = suggest_categories(db, test_user.id, input_data, threshold=0.3)

        # Skincare should be top suggestion with high confidence
        # (matches domain history, title, and breadcrumbs)
        assert len(suggestions) > 0
        assert suggestions[0].category_name == "Skincare"
        assert suggestions[0].confidence >= 0.9

    def test_deduplicates_by_category(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should keep only highest confidence per category."""
        input_data = SuggestionInput(
            product_url="https://www.sephora.com/product/new",
            title="Skincare Product",
            breadcrumbs=["Skincare"],
        )

        suggestions = suggest_categories(db, test_user.id, input_data, threshold=0.3)

        # Should only have one Skincare entry
        skincare_count = sum(1 for s in suggestions if s.category_name == "Skincare")
        assert skincare_count == 1

    def test_filters_by_threshold(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should filter out low-confidence suggestions."""
        input_data = SuggestionInput(
            product_url="https://unknown-site.com/product",
            title="Generic Product",
        )

        suggestions = suggest_categories(db, test_user.id, input_data, threshold=0.9)

        # High threshold should filter out weak matches
        assert all(s.confidence >= 0.9 for s in suggestions)

    def test_respects_limit(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
        items_with_categories: list[WishlistItem],
    ) -> None:
        """Should respect the limit parameter."""
        input_data = SuggestionInput(
            product_url="https://www.sephora.com/product/new",
            title="Skincare Jewelry Clothing Fragrance Home",
            breadcrumbs=["Skincare", "Jewelry", "Clothing"],
        )

        suggestions = suggest_categories(
            db, test_user.id, input_data, threshold=0.1, limit=2
        )

        assert len(suggestions) <= 2


class TestSuggestCategoriesByKeywords:
    """Test keyword inference strategy (cold start).

    Pierce would call this 'street smarts' - knowing what category
    something belongs to just from the product name, like how he
    knows a moist towelette is for hygiene.
    """

    def test_serum_suggests_skincare(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should suggest Skincare for products containing 'serum'."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "BIOEFFECT EGF Eye Serum 6ml"
        )

        skincare = next((s for s in suggestions if s.category_name == "Skincare"), None)
        assert skincare is not None
        assert skincare.confidence >= 0.8
        assert skincare.source == "keyword_inference"

    def test_ring_suggests_jewelry(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should suggest Jewelry for products containing 'ring'."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "14K Gold Stacking Ring"
        )

        jewelry = next((s for s in suggestions if s.category_name == "Jewelry"), None)
        assert jewelry is not None
        assert jewelry.confidence >= 0.8

    def test_dress_suggests_clothing(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should suggest Clothing for products containing 'dress'."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "Silk Midi Dress in Black"
        )

        clothing = next((s for s in suggestions if s.category_name == "Clothing"), None)
        assert clothing is not None
        assert clothing.confidence >= 0.8

    def test_perfume_suggests_fragrance(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should suggest Fragrance for products containing 'perfume'."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "Chanel No. 5 Perfume 100ml"
        )

        fragrance = next(
            (s for s in suggestions if s.category_name == "Fragrance"), None
        )
        assert fragrance is not None
        assert fragrance.confidence >= 0.8

    def test_candle_suggests_home(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should suggest Home for products containing 'candle'."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "Diptyque Baies Candle"
        )

        home = next((s for s in suggestions if s.category_name == "Home"), None)
        assert home is not None
        assert home.confidence >= 0.8

    def test_returns_empty_for_no_keyword_matches(
        self, db: Session, test_user: User, categories: dict[str, Category]
    ) -> None:
        """Should return empty when no keywords match."""
        suggestions = suggest_categories_by_keywords(
            db, test_user.id, "Generic Electronic Gadget"
        )

        # No skincare/jewelry/clothing keywords in title
        assert len(suggestions) == 0

    def test_keyword_inference_in_combined_suggest(
        self,
        db: Session,
        test_user: User,
        categories: dict[str, Category],
    ) -> None:
        """Should use keyword inference in combined suggest_categories."""
        # No history, no breadcrumbs - only keyword inference
        input_data = SuggestionInput(
            product_url="https://unknown-new-site.com/product",
            title="Vitamin C Serum for Face",
        )

        suggestions = suggest_categories(db, test_user.id, input_data, threshold=0.3)

        # Should still suggest Skincare based on keyword inference
        skincare = next((s for s in suggestions if s.category_name == "Skincare"), None)
        assert skincare is not None
        assert skincare.source == "keyword_inference"
