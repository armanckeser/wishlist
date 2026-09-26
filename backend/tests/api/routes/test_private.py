"""Tests for private endpoints.

Community-themed tests for internal API functionality.
"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.features.budget.service import get_budget_by_user_id
from app.features.category.service import get_categories_for_user
from app.features.url_parser.models import ProductMetadata
from app.features.users.models import User
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import (
    create_wishlist_item,
    get_wishlist_items_for_user,
)


def test_create_user(client: TestClient, db: Session) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/private/users/",
        json={
            "email": "pollo@listo.com",
            "password": "password123",
            "full_name": "Pollo Listo",
        },
    )

    assert r.status_code == 200

    data = r.json()

    user = db.exec(select(User).where(User.id == data["id"])).first()

    assert user
    assert user.email == "pollo@listo.com"
    assert user.full_name == "Pollo Listo"


class TestPrepopulateEndpoint:
    """Tests for the prepopulate test data endpoint. Dean Pelton approved."""

    @patch("app.api.routes.private.parse_url")
    @patch("app.api.routes.private.DATA_DIR")
    def test_prepopulate_creates_budget_categories_and_test_user(
        self,
        mock_data_dir: MagicMock,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        tmp_path: Path,
        superuser: User,
    ) -> None:
        """Prepopulate creates budget, categories, and test user when user has no items."""
        # Create temp CSV with test URLs
        csv_path = tmp_path / "product_urls.csv"
        csv_path.write_text(
            "https://mejuri.com/products/hawthorne-ring\n"
            "https://example.com/dreamatorium-set\n"
        )
        mock_data_dir.__truediv__ = MagicMock(
            side_effect=lambda x: csv_path if x == "product_urls.csv" else tmp_path / x
        )

        # Mock parse_url to return Community-themed products
        mock_parse_url.side_effect = [
            (
                ProductMetadata(
                    title="Hawthorne Ring",
                    description="A ring for the Study Group",
                    price_cents=29900,
                    image_url="https://example.com/ring.jpg",
                    source_url="https://mejuri.com/products/hawthorne-ring",
                ),
                "json-ld",
            ),
            (
                ProductMetadata(
                    title="Dreamatorium Equipment Set",
                    description="For imagination adventures. Cool cool cool.",
                    price_cents=49999,
                    image_url="https://example.com/dreamatorium.jpg",
                    source_url="https://example.com/dreamatorium-set",
                ),
                "opengraph",
            ),
        ]

        response = client.post(
            f"{settings.API_V1_STR}/private/prepopulate",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Verify budget was set
        assert data["budget_set"] is True
        budget = get_budget_by_user_id(db, superuser.id)
        assert budget is not None
        assert budget.cents_at_last_update == 50000  # $500
        assert budget.monthly_rate_cents == 60000  # $600/mo

        # Verify categories were created
        assert data["categories_created"] == 6
        categories = get_categories_for_user(db, superuser.id)
        assert len(categories) == 6

        # Verify test user (Abed) was created
        assert data["test_user_created"] is True
        assert data["test_user_id"] is not None
        abed = db.exec(
            select(User).where(User.email == "abed.nadir@greendale.edu")
        ).first()
        assert abed is not None
        assert abed.full_name == "Abed Nadir"

        # Verify items were created from parsed URLs
        assert data["items_created"] == 2
        items, _ = get_wishlist_items_for_user(db, superuser.id)
        titles = {item.title for item in items}
        assert "Hawthorne Ring" in titles
        assert "Dreamatorium Equipment Set" in titles

        # Verify no errors
        assert data["errors"] == []

    def test_prepopulate_skips_when_user_has_items(
        self,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        superuser: User,
    ) -> None:
        """Prepopulate returns early with error when user already has wishlist items."""
        # Create an existing item for the user
        item_create = WishlistItemCreate(
            title="Inspector Spacetime DVD Collection",
            price_cents=4999,
            description="All 6 seasons and a movie",
        )
        create_wishlist_item(db, item_create, superuser.id)

        response = client.post(
            f"{settings.API_V1_STR}/private/prepopulate",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Should skip item import but still set budget
        assert data["items_created"] == 0
        assert data["budget_set"] is True
        assert "User already has wishlist items" in data["errors"][0]

    @patch("app.api.routes.private.DATA_DIR")
    def test_prepopulate_handles_missing_csv_gracefully(
        self,
        mock_data_dir: MagicMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        tmp_path: Path,
        superuser: User,
    ) -> None:
        """Prepopulate returns error when CSV file is missing."""
        # Point DATA_DIR to temp directory without the CSV file
        mock_data_dir.__truediv__ = MagicMock(side_effect=lambda x: tmp_path / x)

        response = client.post(
            f"{settings.API_V1_STR}/private/prepopulate",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # Budget and test user should still be created
        assert data["budget_set"] is True
        assert data["test_user_created"] is True

        # No items created due to missing CSV
        assert data["items_created"] == 0
        assert "product_urls.csv not found" in data["errors"]

    @patch("app.api.routes.private.parse_url")
    @patch("app.api.routes.private.DATA_DIR")
    def test_prepopulate_handles_parse_errors(
        self,
        mock_data_dir: MagicMock,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        tmp_path: Path,
        superuser: User,
    ) -> None:
        """Prepopulate captures parse errors and continues with other URLs."""
        # Create CSV with URLs
        csv_path = tmp_path / "product_urls.csv"
        csv_path.write_text(
            "https://sephora.com/blocked-product\n"
            "https://mejuri.com/working-product\n"
        )
        mock_data_dir.__truediv__ = MagicMock(
            side_effect=lambda x: csv_path if x == "product_urls.csv" else tmp_path / x
        )

        # First URL fails, second succeeds
        mock_parse_url.side_effect = [
            Exception("Site blocks automated requests"),
            (
                ProductMetadata(
                    title="Troy and Abed Mug",
                    price_cents=1999,
                    source_url="https://mejuri.com/working-product",
                ),
                "json-ld",
            ),
        ]

        response = client.post(
            f"{settings.API_V1_STR}/private/prepopulate",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # One item created, one error
        assert data["items_created"] == 1
        assert len(data["errors"]) == 1
        assert "Failed to parse" in data["errors"][0]

        # Verify the successful item was created
        items, _ = get_wishlist_items_for_user(db, superuser.id)
        assert any(item.title == "Troy and Abed Mug" for item in items)

    @patch("app.api.routes.private.parse_url")
    @patch("app.api.routes.private.DATA_DIR")
    def test_prepopulate_skips_items_without_title(
        self,
        mock_data_dir: MagicMock,
        mock_parse_url: AsyncMock,
        client: TestClient,
        superuser_token_headers: dict[str, str],
        db: Session,
        tmp_path: Path,
        superuser: User,
    ) -> None:
        """Prepopulate skips items where parse_url returns no title."""
        csv_path = tmp_path / "product_urls.csv"
        csv_path.write_text("https://example.com/no-title-product\n")
        mock_data_dir.__truediv__ = MagicMock(
            side_effect=lambda x: csv_path if x == "product_urls.csv" else tmp_path / x
        )

        # Return metadata without title
        mock_parse_url.return_value = (
            ProductMetadata(
                title=None,
                price_cents=9999,
                source_url="https://example.com/no-title-product",
            ),
            "opengraph",
        )

        response = client.post(
            f"{settings.API_V1_STR}/private/prepopulate",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        data = response.json()

        # No items created due to missing title
        assert data["items_created"] == 0
        assert any("No title found" in error for error in data["errors"])

    def test_prepopulate_requires_auth(self, client: TestClient) -> None:
        """Prepopulate endpoint requires authentication."""
        response = client.post(f"{settings.API_V1_STR}/private/prepopulate")
        assert response.status_code == 401
