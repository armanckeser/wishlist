"""Tests for the categories system."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.category.models import Category, CategoryCreate
from app.features.category.service import (
    create_category,
    create_default_categories_for_user,
    get_categories_for_user,
)
from app.features.users.models import User, UserCreate
from app.features.users.service import create_user, get_user_by_email
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item


def get_superuser(db: Session) -> User:
    """Get or create the superuser from the database."""
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    if user:
        return user
    user_in = UserCreate(
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
        is_superuser=True,
    )
    return create_user(session=db, user_create=user_in)


def get_normal_user(db: Session) -> User:
    """Get or create a normal test user."""
    user = get_user_by_email(session=db, email=settings.EMAIL_TEST_USER)
    if user:
        return user
    user_in = UserCreate(
        email=settings.EMAIL_TEST_USER,
        password="testpassword",
        is_superuser=False,
    )
    return create_user(session=db, user_create=user_in)


def test_create_default_categories(db: Session) -> None:
    """Test that default categories are created for a user."""
    user = get_superuser(db)

    # Create default categories
    categories = create_default_categories_for_user(db, user.id)

    assert len(categories) == 6
    category_names = {category.name for category in categories}
    assert category_names == {
        "Skincare",
        "Fragrance",
        "Jewelry",
        "Clothing",
        "Accessories",
        "Home",
    }


def test_create_item_with_categories(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test creating a wishlist item with categories."""
    user = get_superuser(db)

    # Ensure user has categories
    existing_categories = get_categories_for_user(db, user.id)
    if not existing_categories:
        create_default_categories_for_user(db, user.id)
        existing_categories = get_categories_for_user(db, user.id)

    # Pick two categories
    category_ids = [str(existing_categories[0].id), str(existing_categories[1].id)]

    # Create item with categories via API
    response = client.post(
        f"{settings.API_V1_STR}/wishlist/",
        headers=superuser_token_headers,
        json={
            "title": "Troy and Abed Test Item",
            "price_cents": 1000,
            "category_ids": category_ids,
        },
    )

    assert response.status_code == 200
    content = response.json()

    # Verify categories are returned
    assert "categories" in content
    assert len(content["categories"]) == 2
    returned_category_ids = {category["id"] for category in content["categories"]}
    assert returned_category_ids == set(category_ids)


def test_update_item_add_categories(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test updating a wishlist item to add categories."""
    user = get_superuser(db)

    # Create item without categories
    item_in = WishlistItemCreate(
        title="Inspector Spacetime Gadget",
        price_cents=2500,
    )
    item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

    # Ensure user has categories
    existing_categories = get_categories_for_user(db, user.id)
    if not existing_categories:
        create_default_categories_for_user(db, user.id)
        existing_categories = get_categories_for_user(db, user.id)

    # Update item to add categories
    category_ids = [str(existing_categories[0].id)]
    response = client.patch(
        f"{settings.API_V1_STR}/wishlist/{item.id}",
        headers=superuser_token_headers,
        json={"category_ids": category_ids},
    )

    assert response.status_code == 200
    content = response.json()

    # Verify categories are returned
    assert "categories" in content
    assert len(content["categories"]) == 1
    assert content["categories"][0]["id"] == category_ids[0]


def test_fetch_items_includes_categories(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Test that fetching items includes their categories."""
    user = get_superuser(db)

    # Ensure user has categories
    existing_categories = get_categories_for_user(db, user.id)
    if not existing_categories:
        create_default_categories_for_user(db, user.id)
        existing_categories = get_categories_for_user(db, user.id)

    # Create item with categories
    item_in = WishlistItemCreate(
        title="Paintball Episode Marker",
        price_cents=5000,
        category_ids=[existing_categories[0].id],
    )
    create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

    # Fetch items
    response = client.get(
        f"{settings.API_V1_STR}/wishlist/",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    content = response.json()

    # Find our test item
    test_items = [
        item for item in content["data"] if item["title"] == "Paintball Episode Marker"
    ]
    assert len(test_items) == 1

    # Verify it has categories
    assert "categories" in test_items[0]
    assert len(test_items[0]["categories"]) >= 1


class TestGetItemCategories:
    """Tests for GET /wishlist/{item_id}/categories endpoint."""

    def test_get_item_categories_returns_empty_list_like_abeds_emotions(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test getting categories for an item with no categories."""
        user = get_superuser(db)

        item_in = WishlistItemCreate(
            title="Dreamatorium Component",
            price_cents=1500,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["data"] == []
        assert content["count"] == 0

    def test_get_item_categories_returns_assigned_categories_like_study_group_roles(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test getting categories for an item with categories assigned."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="Greendale Human Being Costume",
            price_cents=4500,
            category_ids=[existing_categories[0].id, existing_categories[1].id],
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["count"] == 2
        returned_ids = {category["id"] for category in content["data"]}
        expected_ids = {str(existing_categories[0].id), str(existing_categories[1].id)}
        assert returned_ids == expected_ids

    def test_get_item_categories_nonexistent_item_returns_404_like_changnesia(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test getting categories for a non-existent item returns 404."""
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}/categories",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_get_item_categories_other_users_item_returns_404_like_city_college(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot get categories of other users' items.

        Returns 404 rather than 403 to avoid revealing item existence.
        """
        superuser = get_superuser(db)

        item_in = WishlistItemCreate(
            title="Dean's Secret Dalmatian Outfit",
            price_cents=3000,
        )
        item = create_wishlist_item(
            session=db, item_create=item_in, owner_id=superuser.id
        )

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404


class TestAddCategoriesToItem:
    """Tests for POST /wishlist/{item_id}/categories endpoint."""

    def test_add_categories_to_item_like_adding_members_to_study_group(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully adding categories to an item."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="Pillows for Epic Pillow Fight",
            price_cents=2000,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        category_ids = [str(existing_categories[0].id), str(existing_categories[1].id)]
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
            json={"category_ids": category_ids},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["count"] == 2
        returned_ids = {category["id"] for category in content["data"]}
        assert returned_ids == set(category_ids)

    def test_add_categories_skips_duplicates_like_repeated_paintball_games(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that adding a category already on the item doesn't duplicate it."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="Paintball Gun",
            price_cents=8000,
            category_ids=[existing_categories[0].id],
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
            json={
                "category_ids": [
                    str(existing_categories[0].id),
                    str(existing_categories[1].id),
                ]
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["count"] == 2

    def test_add_categories_nonexistent_item_returns_404_like_sixth_season(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test adding categories to a non-existent item returns 404."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}/categories",
            headers=superuser_token_headers,
            json={"category_ids": [str(existing_categories[0].id)]},
        )

        assert response.status_code == 404

    def test_add_nonexistent_category_returns_404_like_missing_movie_reference(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test adding a non-existent category to an item returns 404."""
        user = get_superuser(db)

        item_in = WishlistItemCreate(
            title="Troy's Monkey",
            price_cents=5000,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
            json={"category_ids": [str(uuid.uuid4())]},
        )

        assert response.status_code == 404

    def test_add_other_users_category_returns_404_like_stealing_deans_outfit(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test adding another user's category to own item returns 404."""
        user = get_superuser(db)
        other_user = get_normal_user(db)

        other_users_category = create_category(
            db,
            CategoryCreate(name="Other User's Category"),
            other_user.id,
        )

        item_in = WishlistItemCreate(
            title="Jeff's Hair Products",
            price_cents=15000,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
            json={"category_ids": [str(other_users_category.id)]},
        )

        assert response.status_code == 404

    def test_add_categories_to_other_users_item_returns_404_like_breaking_into_study_room(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test adding categories to another user's item returns 404.

        Returns 404 rather than 403 to avoid revealing item existence.
        """
        superuser = get_superuser(db)
        normal_user = get_normal_user(db)

        normal_user_categories = get_categories_for_user(db, normal_user.id)
        if not normal_user_categories:
            create_default_categories_for_user(db, normal_user.id)
            normal_user_categories = get_categories_for_user(db, normal_user.id)

        item_in = WishlistItemCreate(
            title="Superuser's Secret Item",
            price_cents=10000,
        )
        item = create_wishlist_item(
            session=db, item_create=item_in, owner_id=superuser.id
        )

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=normal_user_token_headers,
            json={"category_ids": [str(normal_user_categories[0].id)]},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "invalid_payload",
        [
            {},
            {"category_ids": "not-a-list"},
            {"category_ids": ["not-a-uuid"]},
        ],
    )
    def test_add_categories_validates_payload_like_annie_validates_assignments(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        invalid_payload: dict,
    ) -> None:
        """Test that add categories endpoint validates the request payload."""
        user = get_superuser(db)

        item_in = WishlistItemCreate(
            title="Validation Test Item",
            price_cents=1000,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
            json=invalid_payload,
        )

        assert response.status_code == 422


class TestRemoveCategoryFromItem:
    """Tests for DELETE /wishlist/{item_id}/categories/{category_id} endpoint."""

    def test_remove_category_from_item_like_britta_leaving_study_group(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully removing a category from an item."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="Study Group Memorabilia",
            price_cents=7500,
            category_ids=[existing_categories[0].id, existing_categories[1].id],
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories/{existing_categories[0].id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["message"] == "Category removed from item"

        verify_response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
        )
        assert verify_response.status_code == 200
        verify_content = verify_response.json()
        assert verify_content["count"] == 1
        assert verify_content["data"][0]["id"] == str(existing_categories[1].id)

    def test_remove_nonexistent_item_returns_404_like_pierce_leaving(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test removing category from a non-existent item returns 404."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}/categories/{existing_categories[0].id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_remove_category_not_on_item_returns_404_like_wrong_timeline(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test removing a category not assigned to the item returns 404."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="Abed's Director Chair",
            price_cents=12000,
            category_ids=[existing_categories[0].id],
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories/{existing_categories[2].id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_remove_nonexistent_category_returns_404_like_fake_classes(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test removing a non-existent category ID returns 404."""
        user = get_superuser(db)

        item_in = WishlistItemCreate(
            title="Conspiracy Corkboard",
            price_cents=3500,
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_remove_category_from_other_users_item_returns_404_like_infiltrating_city_college(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test removing category from another user's item returns 404.

        Returns 404 rather than 403 to avoid revealing item existence.
        """
        superuser = get_superuser(db)

        superuser_categories = get_categories_for_user(db, superuser.id)
        if not superuser_categories:
            create_default_categories_for_user(db, superuser.id)
            superuser_categories = get_categories_for_user(db, superuser.id)

        item_in = WishlistItemCreate(
            title="Superuser's Protected Item",
            price_cents=20000,
            category_ids=[superuser_categories[0].id],
        )
        item = create_wishlist_item(
            session=db, item_create=item_in, owner_id=superuser.id
        )

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories/{superuser_categories[0].id}",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404

    def test_remove_last_category_leaves_item_with_no_categories(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test removing the last category from an item leaves it uncategorized."""
        user = get_superuser(db)

        existing_categories = get_categories_for_user(db, user.id)
        if not existing_categories:
            create_default_categories_for_user(db, user.id)
            existing_categories = get_categories_for_user(db, user.id)

        item_in = WishlistItemCreate(
            title="E Pluribus Anus Flag",
            price_cents=2500,
            category_ids=[existing_categories[0].id],
        )
        item = create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories/{existing_categories[0].id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200

        verify_response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}/categories",
            headers=superuser_token_headers,
        )
        assert verify_response.status_code == 200
        verify_content = verify_response.json()
        assert verify_content["count"] == 0
        assert verify_content["data"] == []


# =============================================================================
# API Router Tests for /categories/ endpoints - Community TV Show themed
# =============================================================================


class TestReadCategoriesEndpoint:
    """Tests for GET /categories/ endpoint - like browsing Greendale's course catalog."""

    def test_read_categories_returns_all_user_categories_like_greendale_majors(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test fetching all categories for the current user."""
        user = get_superuser(db)
        create_default_categories_for_user(db, user.id)

        response = client.get(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert "data" in content
        assert "count" in content
        assert content["count"] == 6  # Default categories
        assert len(content["data"]) == 6

    def test_read_categories_empty_for_new_user_like_empty_study_room(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that a user with no categories returns empty list."""
        # Just use auth headers without creating categories
        get_superuser(db)  # Ensure user exists

        response = client.get(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["data"] == []
        assert content["count"] == 0

    def test_read_categories_requires_auth_like_greendale_id_card(
        self,
        client: TestClient,
    ) -> None:
        """Test that unauthenticated requests are rejected."""
        response = client.get(f"{settings.API_V1_STR}/categories/")

        assert response.status_code == 401


class TestCreateCategoryEndpoint:
    """Tests for POST /categories/ endpoint - like Dean Pelton creating new courses."""

    def test_create_category_success_like_new_greendale_class(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully creating a new category."""
        get_superuser(db)

        response = client.post(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
            json={"name": "Ladders and Fire Safety"},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["name"] == "Ladders and Fire Safety"
        assert "id" in content
        assert "created_at" in content
        assert content["parent_id"] is None

    def test_create_category_with_parent_like_advanced_course(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test creating a subcategory with a parent."""
        user = get_superuser(db)

        # Create parent category first
        parent = create_category(db, CategoryCreate(name="Spanish"), user.id)

        response = client.post(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
            json={"name": "Advanced Spanish", "parent_id": str(parent.id)},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["name"] == "Advanced Spanish"
        assert content["parent_id"] == str(parent.id)

    def test_create_category_with_invalid_parent_like_fake_class(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test creating category with non-existent parent fails."""
        get_superuser(db)

        response = client.post(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
            json={"name": "Phantom Course", "parent_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    def test_create_category_with_other_users_parent_like_city_college_infiltration(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test creating category with another user's category as parent fails."""
        superuser = get_superuser(db)
        get_normal_user(db)

        # Create category owned by superuser
        parent = create_category(
            db, CategoryCreate(name="Dean's Private Collection"), superuser.id
        )

        # Try to use it as parent for normal user's category
        response = client.post(
            f"{settings.API_V1_STR}/categories/",
            headers=normal_user_token_headers,
            json={"name": "Stolen Ideas", "parent_id": str(parent.id)},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "invalid_name",
        [
            "",
            "a" * 101,  # Max is 100
        ],
    )
    def test_create_category_validates_name_like_course_registration(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        invalid_name: str,
    ) -> None:
        """Test that category name validation works."""
        get_superuser(db)

        response = client.post(
            f"{settings.API_V1_STR}/categories/",
            headers=superuser_token_headers,
            json={"name": invalid_name},
        )

        assert response.status_code == 422


class TestReadSingleCategoryEndpoint:
    """Tests for GET /categories/{id} endpoint - like checking a specific class."""

    def test_read_single_category_success_like_checking_class_schedule(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test fetching a single category by ID."""
        user = get_superuser(db)
        category = create_category(
            db, CategoryCreate(name="History of Ice Cream"), user.id
        )

        response = client.get(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["id"] == str(category.id)
        assert content["name"] == "History of Ice Cream"

    def test_read_nonexistent_category_like_searching_for_phantom_class(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that fetching non-existent category returns 404."""
        get_superuser(db)

        response = client.get(
            f"{settings.API_V1_STR}/categories/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_read_other_users_category_denied_like_city_college_spying(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot read other users' categories."""
        superuser = get_superuser(db)
        get_normal_user(db)

        category = create_category(
            db, CategoryCreate(name="Jeff's Secret Hair Products"), superuser.id
        )

        response = client.get(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404


class TestUpdateCategoryEndpoint:
    """Tests for PATCH /categories/{id} endpoint - like changing course names mid-semester."""

    def test_update_category_name_like_rebranding_a_class(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test updating a category's name."""
        user = get_superuser(db)
        category = create_category(db, CategoryCreate(name="Intro to Pottery"), user.id)

        response = client.patch(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=superuser_token_headers,
            json={"name": "Advanced Pottery: Beyond Mugs"},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["name"] == "Advanced Pottery: Beyond Mugs"
        assert content["id"] == str(category.id)

    def test_update_category_parent_like_reorganizing_departments(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test updating a category's parent."""
        user = get_superuser(db)
        parent = create_category(db, CategoryCreate(name="Arts"), user.id)
        child = create_category(db, CategoryCreate(name="Finger Painting"), user.id)

        response = client.patch(
            f"{settings.API_V1_STR}/categories/{child.id}",
            headers=superuser_token_headers,
            json={"parent_id": str(parent.id)},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["parent_id"] == str(parent.id)

    def test_update_category_self_parent_rejected_like_chang_teaching_chang(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that a category cannot be its own parent."""
        user = get_superuser(db)
        category = create_category(
            db, CategoryCreate(name="Recursive Studies"), user.id
        )

        response = client.patch(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=superuser_token_headers,
            json={"parent_id": str(category.id)},
        )

        assert response.status_code == 400

    def test_update_nonexistent_category_like_editing_phantom_syllabus(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test updating non-existent category returns 404."""
        get_superuser(db)

        response = client.patch(
            f"{settings.API_V1_STR}/categories/{uuid.uuid4()}",
            headers=superuser_token_headers,
            json={"name": "Ghost Studies"},
        )

        assert response.status_code == 404

    def test_update_other_users_category_denied_like_hacking_grades(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot update other users' categories."""
        superuser = get_superuser(db)
        get_normal_user(db)

        category = create_category(
            db, CategoryCreate(name="Annie's Binder Organization"), superuser.id
        )

        response = client.patch(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=normal_user_token_headers,
            json={"name": "Britta'd Binders"},
        )

        assert response.status_code == 404


class TestDeleteCategoryEndpoint:
    """Tests for DELETE /categories/{id} endpoint - like canceling Greendale classes."""

    def test_delete_category_success_like_budget_cuts(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully deleting a category."""
        user = get_superuser(db)
        category = create_category(
            db, CategoryCreate(name="Underwater Basket Weaving"), user.id
        )
        category_id = category.id

        response = client.delete(
            f"{settings.API_V1_STR}/categories/{category_id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["message"] == "Category deleted successfully"

        # Verify it's actually deleted
        deleted_category = db.get(Category, category_id)
        assert deleted_category is None

    def test_delete_nonexistent_category_like_canceling_fake_class(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test deleting non-existent category returns 404."""
        get_superuser(db)

        response = client.delete(
            f"{settings.API_V1_STR}/categories/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_delete_other_users_category_denied_like_sabotaging_rival_school(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot delete other users' categories."""
        superuser = get_superuser(db)
        get_normal_user(db)

        category = create_category(
            db, CategoryCreate(name="Pierce's Memorabilia"), superuser.id
        )

        response = client.delete(
            f"{settings.API_V1_STR}/categories/{category.id}",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404

        # Verify category still exists
        db.refresh(category)
        assert category is not None


class TestCategorySuggestionsEndpoint:
    """Tests for POST /categories/suggestions endpoint - like getting course recommendations."""

    def test_suggestions_with_title_match_like_abed_pattern_recognition(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that suggestions return based on title matching."""
        user = get_superuser(db)
        create_default_categories_for_user(db, user.id)

        response = client.post(
            f"{settings.API_V1_STR}/categories/suggestions",
            headers=superuser_token_headers,
            json={
                "title": "Diamond Skincare Serum",
                "product_url": "https://example.com/product",
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert "suggestions" in content

        # Should find Skincare category from title
        suggestion_names = [s["category_name"] for s in content["suggestions"]]
        assert "Skincare" in suggestion_names

    def test_suggestions_empty_request_still_works_like_troy_asking_for_help(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that empty suggestion request returns valid response."""
        user = get_superuser(db)
        create_default_categories_for_user(db, user.id)

        response = client.post(
            f"{settings.API_V1_STR}/categories/suggestions",
            headers=superuser_token_headers,
            json={},
        )

        assert response.status_code == 200
        content = response.json()
        assert "suggestions" in content
        assert isinstance(content["suggestions"], list)

    def test_suggestions_with_breadcrumbs_like_following_trail(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test suggestions using breadcrumb data."""
        user = get_superuser(db)
        create_default_categories_for_user(db, user.id)

        response = client.post(
            f"{settings.API_V1_STR}/categories/suggestions",
            headers=superuser_token_headers,
            json={
                "breadcrumbs": ["Women", "Jewelry", "Rings"],
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert "suggestions" in content

        # Should find Jewelry from breadcrumbs
        suggestion_names = [s["category_name"] for s in content["suggestions"]]
        assert "Jewelry" in suggestion_names

    def test_suggestions_requires_auth_like_library_card(
        self,
        client: TestClient,
    ) -> None:
        """Test that suggestions endpoint requires authentication."""
        response = client.post(
            f"{settings.API_V1_STR}/categories/suggestions",
            json={"title": "Some Product"},
        )

        assert response.status_code == 401

    def test_suggestions_include_confidence_and_source_like_abed_citing_sources(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that suggestions include confidence scores and sources."""
        user = get_superuser(db)
        create_default_categories_for_user(db, user.id)

        response = client.post(
            f"{settings.API_V1_STR}/categories/suggestions",
            headers=superuser_token_headers,
            json={
                "title": "Luxury Fragrance Collection",
            },
        )

        assert response.status_code == 200
        content = response.json()

        if content["suggestions"]:
            suggestion = content["suggestions"][0]
            assert "category_id" in suggestion
            assert "category_name" in suggestion
            assert "confidence" in suggestion
            assert "source" in suggestion
            assert 0 <= suggestion["confidence"] <= 1
