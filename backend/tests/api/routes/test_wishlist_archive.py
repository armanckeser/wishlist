"""Tests for the wishlist archive endpoints."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.users.models import User
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import (
    WishlistItem,
    WishlistItemCreate,
    WishlistItemStatus,
)
from app.features.wishlist_item.service import create_wishlist_item


def create_wishlist_item_for_user(
    db: Session, user: User, title: str = "Test Item"
) -> WishlistItem:
    """Create a wishlist item owned by the given user."""
    item_in = WishlistItemCreate(
        title=title,
        description="A test wishlist item",
        price_cents=1000,
    )
    return create_wishlist_item(session=db, item_create=item_in, owner_id=user.id)


class TestBulkArchive:
    """Tests for the bulk archive endpoint - Community-style test names."""

    def test_archive_single_item_like_jeff_winger_archiving_his_ego(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test successfully archiving a single wishlist item."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Jeff's Trophy")

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 1

        db.refresh(item)
        assert item.status == WishlistItemStatus.ARCHIVED
        assert item.archived_at is not None

    def test_archive_multiple_items_like_study_group_memories(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test archiving multiple items at once."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        items = [
            create_wishlist_item_for_user(db, user, title="Paintball Trophy"),
            create_wishlist_item_for_user(db, user, title="Pillow Fort Blueprint"),
            create_wishlist_item_for_user(db, user, title="Blanket Fort Design"),
        ]

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id) for item in items]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 3

        for item in items:
            db.refresh(item)
            assert item.status == WishlistItemStatus.ARCHIVED
            assert item.archived_at is not None

    def test_archive_already_archived_item_returns_zero_like_changs_second_chances(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that archiving an already archived item doesn't count."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Chang's Keytar")

        # Archive once
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        # Try to archive again
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 0

    def test_archive_nonexistent_item_returns_zero_like_city_college_wins(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
    ) -> None:
        """Test that archiving a non-existent item doesn't fail but returns 0."""
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(uuid.uuid4())]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 0

    def test_archive_other_users_item_returns_zero_like_britta_helping(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that users can't archive items belonging to others."""
        superuser = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert superuser is not None

        item = create_wishlist_item_for_user(db, superuser, title="Dean's Dalmatian")

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=normal_user_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 0

        # Item should still be wishlisted
        db.refresh(item)
        assert item.status == WishlistItemStatus.WISHLISTED

    def test_archive_mixed_items_only_archives_valid_ones_like_abed_meta_commentary(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test archiving mix of own items, others' items, and non-existent."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        own_item = create_wishlist_item_for_user(db, user, title="Abed's Camera")
        already_archived = create_wishlist_item_for_user(
            db, user, title="Troy's Blanket"
        )

        # Pre-archive one item
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(already_archived.id)]},
        )

        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={
                "item_ids": [
                    str(own_item.id),
                    str(already_archived.id),
                    str(uuid.uuid4()),
                ]
            },
        )

        assert response.status_code == 200
        content = response.json()
        assert content["archived_count"] == 1  # Only own_item gets archived

    @pytest.mark.parametrize(
        "invalid_payload,expected_error",
        [
            ({"item_ids": []}, "List should have at least 1 item"),
            ({}, "Field required"),
        ],
    )
    def test_archive_validates_payload_like_annie_validates_study_plans(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        invalid_payload: dict,
        expected_error: str,
    ) -> None:
        """Test that archive endpoint validates the request payload."""
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json=invalid_payload,
        )

        assert response.status_code == 422
        assert expected_error in str(response.json())

    def test_archived_items_appear_in_user_wishlist_like_troy_in_pillow_fort(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
    ) -> None:
        """Test that archived items appear when fetching user's own wishlist."""
        user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
        assert user is not None

        item = create_wishlist_item_for_user(db, user, title="Troy's Ship in Bottle")

        # Archive it
        client.post(
            f"{settings.API_V1_STR}/wishlist/items/archive",
            headers=superuser_token_headers,
            json={"item_ids": [str(item.id)]},
        )

        # Fetch own wishlist - should include archived items without error
        response = client.get(
            f"{settings.API_V1_STR}/wishlist/",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        content = response.json()

        # Find the archived item
        archived_items = [i for i in content["data"] if i["status"] == "archived"]
        assert len(archived_items) >= 1
        assert any(i["title"] == "Troy's Ship in Bottle" for i in archived_items)
