"""Tests for the wishlist item endpoints - Community TV show themed."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.category.models import Category
from app.features.users.models import User
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import (
    WishlistItem,
    WishlistItemCreate,
    WishlistItemStatus,
)
from app.features.wishlist_item.service import create_wishlist_item


def create_wishlist_item_for_user(
    db: Session, user: User, title: str = "Test Item", price_cents: int = 1000
) -> WishlistItem:
    """Create a wishlist item owned by the given user."""
    item_in = WishlistItemCreate(
        title=title,
        description="A test wishlist item",
        price_cents=price_cents,
    )
    return create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)


def create_category_for_user(
    db: Session, user: User, name: str = "Test Category"
) -> Category:
    """Create a category owned by the given user."""
    category = Category(name=name, owner_id=user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


class TestReadWishlistItem:
    """Tests for GET /wishlist/{item_id} endpoint."""

    def test_read_item_like_abed_reads_film_tropes(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully reading a single wishlist item."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(
            db, user, title="Inspector Spacetime DVD Collection"
        )

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["id"] == str(item.id)
        assert content["title"] == "Inspector Spacetime DVD Collection"
        assert content["status"] == "wishlisted"

    def test_read_nonexistent_item_like_pierce_looking_for_respect(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test reading a non-existent item returns 404."""
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_read_other_users_item_like_chang_sneaking_into_study_group(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot read items belonging to others."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        item = create_wishlist_item_for_user(
            db, superuser, title="Dean's Outfit Collection"
        )

        response = client.get(
            f"{settings.API_V1_STR}/wishlist/{item.id}",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404


class TestDeleteWishlistItem:
    """Tests for DELETE /wishlist/{item_id} endpoint."""

    def test_delete_item_like_jeff_deleting_his_old_lawyer_contacts(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully deleting a wishlist item."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Britta's Activist Merch")

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()
        assert content["message"] == "Item deleted successfully"

        # Verify item is actually deleted
        db.expire_all()
        deleted_item = db.get(WishlistItem, item.id)
        assert deleted_item is None

    def test_delete_nonexistent_item_like_city_college_dean_schemes(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test deleting a non-existent item returns 404."""
        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{uuid.uuid4()}",
            headers=superuser_token_headers,
        )

        assert response.status_code == 404

    def test_delete_other_users_item_like_starburns_stealing(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot delete items belonging to others."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        item = create_wishlist_item_for_user(
            db, superuser, title="Troy's Football Trophy"
        )

        response = client.delete(
            f"{settings.API_V1_STR}/wishlist/{item.id}",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 404

        # Item should still exist
        db.refresh(item)
        assert item is not None


class TestBulkDelete:
    """Tests for DELETE /wishlist/items/bulk endpoint."""

    def test_bulk_delete_like_dean_clearing_out_costume_closet(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully deleting multiple items at once."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        items = [
            create_wishlist_item_for_user(db, user, title="Dalmatian Costume"),
            create_wishlist_item_for_user(db, user, title="Peanut Bar Outfit"),
            create_wishlist_item_for_user(db, user, title="Payday Rapper Costume"),
        ]
        item_ids = [str(item.id) for item in items]

        response = client.request(
            "DELETE",
            f"{settings.API_V1_STR}/wishlist/items/bulk",
            headers=superuser_token_headers,
            json={"item_ids": item_ids},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["deleted_count"] == 3

        # Verify items are deleted
        db.expire_all()
        for item in items:
            assert db.get(WishlistItem, item.id) is None

    def test_bulk_delete_mixed_ownership_like_paintball_alliances(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test bulk delete only deletes owned items."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        superuser_item = create_wishlist_item_for_user(
            db, superuser, title="Pierce's Moist Towelettes"
        )

        response = client.request(
            "DELETE",
            f"{settings.API_V1_STR}/wishlist/items/bulk",
            headers=normal_user_token_headers,
            json={"item_ids": [str(superuser_item.id), str(uuid.uuid4())]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["deleted_count"] == 0

        # Item should still exist
        db.refresh(superuser_item)
        assert superuser_item is not None

    def test_bulk_delete_nonexistent_items_like_subway_finding_his_humanity(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test bulk delete with non-existent items returns 0."""
        response = client.request(
            "DELETE",
            f"{settings.API_V1_STR}/wishlist/items/bulk",
            headers=superuser_token_headers,
            json={"item_ids": [str(uuid.uuid4()), str(uuid.uuid4())]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["deleted_count"] == 0

    @pytest.mark.parametrize(
        "invalid_payload,expected_error",
        [
            ({"item_ids": []}, "List should have at least 1 item"),
            ({}, "Field required"),
        ],
    )
    def test_bulk_delete_validates_payload_like_annie_validates_assignments(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        invalid_payload: dict,
        expected_error: str,
    ) -> None:
        """Test that bulk delete validates the request payload."""
        response = client.request(
            "DELETE",
            f"{settings.API_V1_STR}/wishlist/items/bulk",
            headers=superuser_token_headers,
            json=invalid_payload,
        )

        assert response.status_code == 422
        assert expected_error in str(response.json())


class TestBulkSetCategories:
    """Tests for PATCH /wishlist/items/categories endpoint."""

    def test_set_categories_like_shirley_organizing_bake_sale(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully setting categories on multiple items."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        items = [
            create_wishlist_item_for_user(db, user, title="Brownie Mix"),
            create_wishlist_item_for_user(db, user, title="Cookie Cutters"),
        ]
        category = create_category_for_user(db, user, name="Baking Supplies")

        response = client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=superuser_token_headers,
            json={
                "item_ids": [str(item.id) for item in items],
                "category_ids": [str(category.id)],
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["updated_count"] == 2

        # Verify categories were set
        for item in items:
            db.refresh(item)
            assert len(item.categories) == 1
            assert item.categories[0].id == category.id

    def test_set_multiple_categories_like_abed_genres(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test setting multiple categories on items."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(
            db, user, title="Inspector Spacetime Box Set"
        )
        categories = [
            create_category_for_user(db, user, name="Sci-Fi"),
            create_category_for_user(db, user, name="British TV"),
            create_category_for_user(db, user, name="Classics"),
        ]

        response = client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=superuser_token_headers,
            json={
                "item_ids": [str(item.id)],
                "category_ids": [str(cat.id) for cat in categories],
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["updated_count"] == 1

        db.refresh(item)
        assert len(item.categories) == 3

    def test_clear_categories_like_jeff_clearing_conscience(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test clearing all categories by passing empty list."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Law Degree Frame")
        category = create_category_for_user(db, user, name="Office Decor")

        # First set a category
        client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=superuser_token_headers,
            json={
                "item_ids": [str(item.id)],
                "category_ids": [str(category.id)],
            },
        )

        db.refresh(item)
        assert len(item.categories) == 1

        # Now clear categories
        response = client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=superuser_token_headers,
            json={
                "item_ids": [str(item.id)],
                "category_ids": [],
            },
        )

        assert response.status_code == 200
        db.refresh(item)
        assert len(item.categories) == 0

    def test_set_categories_other_users_items_like_chang_infiltrating(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users cannot set categories on others' items."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        item = create_wishlist_item_for_user(db, superuser, title="Keytar")
        category = create_category_for_user(db, superuser, name="Musical Instruments")

        response = client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=normal_user_token_headers,
            json={
                "item_ids": [str(item.id)],
                "category_ids": [str(category.id)],
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["updated_count"] == 0

    @pytest.mark.parametrize(
        "invalid_payload,expected_error",
        [
            ({"item_ids": [], "category_ids": []}, "List should have at least 1 item"),
            ({"category_ids": []}, "Field required"),
        ],
    )
    def test_set_categories_validates_payload_like_annie_christmas_pageant(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        invalid_payload: dict,
        expected_error: str,
    ) -> None:
        """Test that bulk set categories validates the request payload."""
        response = client.patch(
            f"{settings.API_V1_STR}/wishlist/items/categories",
            headers=superuser_token_headers,
            json=invalid_payload,
        )

        assert response.status_code == 422
        assert expected_error in str(response.json())


class TestBulkUnarchive:
    """Tests for POST /wishlist/items/unarchive endpoint."""

    def test_unarchive_single_item_like_community_getting_renewed(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully unarchiving a single item."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(
            db, user, title="Human Being Mascot Costume"
        )

        # First archive the item
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        db.refresh(item)
        assert item.status == WishlistItemStatus.ARCHIVED

        # Now unarchive
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 1

        db.refresh(item)
        assert item.status == WishlistItemStatus.WISHLISTED
        assert item.archived_at is None

    def test_unarchive_multiple_items_like_study_group_reuniting(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test unarchiving multiple items at once."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        items = [
            create_wishlist_item_for_user(db, user, title="Dreamatorium Plans"),
            create_wishlist_item_for_user(db, user, title="Blanket Fort Blueprints"),
            create_wishlist_item_for_user(db, user, title="Troy and Abed Mugs"),
        ]

        # Archive all items
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id) for item in items]},
        )

        # Unarchive all
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id) for item in items]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 3

        for item in items:
            db.refresh(item)
            assert item.status == WishlistItemStatus.WISHLISTED

    def test_unarchive_already_wishlisted_returns_zero_like_britta_being_the_worst(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that unarchiving a wishlisted item doesn't count."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Britta's Leather Jacket")
        assert item.status == WishlistItemStatus.WISHLISTED

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 0

    def test_unarchive_nonexistent_item_returns_zero_like_troys_missing_monkey(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test that unarchiving a non-existent item returns 0."""
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json={"item_ids": [str(uuid.uuid4())]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 0

    def test_unarchive_other_users_item_returns_zero_like_fat_neil_excluded(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users can't unarchive items belonging to others."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        item = create_wishlist_item_for_user(
            db, superuser, title="Dungeons and Dragons Set"
        )

        # Archive as superuser
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers={
                "Authorization": f"Bearer {client.post(f'{settings.API_V1_STR}/login/access-token', data={'username': settings.FIRST_SUPERUSER, 'password': settings.FIRST_SUPERUSER_PASSWORD}).json()['access_token']}"
            },
            json={"item_ids": [str(item.id)]},
        )

        # Try to unarchive as normal user
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=normal_user_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 0

    def test_unarchive_mixed_items_only_unarchives_valid_ones_like_meow_meow_beenz(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test unarchiving mix of archived, wishlisted, and non-existent items."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        archived_item = create_wishlist_item_for_user(
            db, user, title="Social Media App"
        )
        wishlisted_item = create_wishlist_item_for_user(
            db, user, title="Voting Machine"
        )

        # Archive one item
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(archived_item.id)]},
        )

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json={
                "item_ids": [
                    str(archived_item.id),
                    str(wishlisted_item.id),
                    str(uuid.uuid4()),
                ]
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["unarchived_count"] == 1  # Only archived_item gets unarchived

    @pytest.mark.parametrize(
        "invalid_payload,expected_error",
        [
            ({"item_ids": []}, "List should have at least 1 item"),
            ({}, "Field required"),
        ],
    )
    def test_unarchive_validates_payload_like_greendale_validates_credits(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        invalid_payload: dict,
        expected_error: str,
    ) -> None:
        """Test that unarchive endpoint validates the request payload."""
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/unarchive",
            headers=superuser_token_headers,
            json=invalid_payload,
        )

        assert response.status_code == 422
        assert expected_error in str(response.json())
