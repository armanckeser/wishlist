"""API tests for price tracking endpoints."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.price_tracking.models import PriceCheckFailureReason
from app.features.price_tracking.service import PriceCheckFailed, PriceObservation
from app.features.users.service import get_user_by_email
from app.features.wishlist_item.models import WishlistItem, WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item
from tests.utils.user import create_random_user

URL = "https://example.com/products/inspector-spacetime-scarf"
FETCH = "app.features.price_tracking.service.fetch_price_observation"


def superuser_item(
    db: Session, *, price_from_url: bool = True, product_url: str | None = URL
) -> WishlistItem:
    user = get_user_by_email(session=db, email=settings.FIRST_SUPERUSER)
    assert user is not None
    return create_wishlist_item(
        db,
        WishlistItemCreate(
            title="Inspector Spacetime scarf",
            price_cents=6_000,
            product_url=product_url,
            price_from_url=price_from_url,
        ),
        user.id,
    )


class TestCreateItem:
    def test_create_with_price_from_url_returns_tracking(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/",
            headers=superuser_token_headers,
            json={
                "title": "Greendale hoodie",
                "price_cents": 4_500,
                "product_url": URL,
                "price_from_url": True,
            },
        )

        assert response.status_code == 200
        tracking = response.json()["price_tracking"]
        assert tracking["enabled"] is True
        assert tracking["eligible"] is True
        assert tracking["original_price_cents"] == 4_500

    def test_create_without_flag_is_not_tracked(
        self, client: TestClient, superuser_token_headers: dict[str, str]
    ) -> None:
        response = client.post(
            f"{settings.API_V1_STR}/wishlist/",
            headers=superuser_token_headers,
            json={
                "title": "Greendale hoodie",
                "price_cents": 4_500,
                "product_url": URL,
            },
        )

        assert response.status_code == 200
        tracking = response.json()["price_tracking"]
        assert tracking["enabled"] is False
        assert tracking["eligible"] is False


class TestHistory:
    def test_history_returns_points(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)

        response = client.get(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/history",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["item_id"] == str(item.id)
        assert body["current_price_cents"] == 6_000
        assert len(body["points"]) == 1
        assert body["points"][0]["price_cents"] == 6_000
        assert body["tracking"]["enabled"] is True

    def test_history_of_someone_elses_item_is_forbidden(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        other = create_random_user(db)
        item = create_wishlist_item(
            db,
            WishlistItemCreate(title="Not yours", price_cents=100, product_url=URL),
            other.id,
        )

        response = client.get(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/history",
            headers=superuser_token_headers,
        )

        assert response.status_code == 403


class TestEnableDisable:
    def test_enable_success(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db, price_from_url=False)

        with patch(FETCH, return_value=PriceObservation(5_500, "USD")):
            response = client.post(
                f"{settings.API_V1_STR}/price-tracking/{item.id}/enable",
                headers=superuser_token_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["price_cents"] == 5_500
        assert body["price_tracking"]["enabled"] is True

    def test_enable_failure_is_friendly_400(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db, price_from_url=False)

        with patch(
            FETCH,
            side_effect=PriceCheckFailed(
                "The store blocked the check.", PriceCheckFailureReason.BLOCKED
            ),
        ):
            response = client.post(
                f"{settings.API_V1_STR}/price-tracking/{item.id}/enable",
                headers=superuser_token_headers,
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "The store blocked the check."

    def test_enable_without_url(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db, price_from_url=False, product_url=None)

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/enable",
            headers=superuser_token_headers,
        )

        assert response.status_code == 400
        assert "product link" in response.json()["detail"]

    def test_disable(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/disable",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        tracking = response.json()["price_tracking"]
        assert tracking["enabled"] is False
        assert tracking["eligible"] is True  # history kept, can re-enable


class TestManualCheck:
    def test_check_is_rate_limited_right_after_seeding(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)  # seeded => checked just now

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/check",
            headers=superuser_token_headers,
        )

        assert response.status_code == 429
        assert "Try again in" in response.json()["detail"]

    def test_check_reports_failure_in_body(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)
        item.price_checked_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(item)
        db.commit()

        with patch(
            FETCH,
            side_effect=PriceCheckFailed(
                "No price on the page - it may be sold out.",
                PriceCheckFailureReason.NO_PRICE,
            ),
        ):
            response = client.post(
                f"{settings.API_V1_STR}/price-tracking/{item.id}/check",
                headers=superuser_token_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["outcome"] == "failed"
        assert body["message"] == "No price on the page - it may be sold out."
        assert body["reason"] == "no_price"
        assert body["tracking"]["last_error_reason"] == "no_price"
        assert body["tracking"]["consecutive_failures"] == 1

    def test_check_success(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)
        item.price_checked_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.add(item)
        db.commit()

        with patch(FETCH, return_value=PriceObservation(6_000, "USD")):
            response = client.post(
                f"{settings.API_V1_STR}/price-tracking/{item.id}/check",
                headers=superuser_token_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["outcome"] == "unchanged"
        assert body["message"] == "Still $60"

    def test_check_on_unverified_item_is_rejected(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db, price_from_url=False)

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/check",
            headers=superuser_token_headers,
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "This item isn't being tracked yet."


class TestRestart:
    def test_restart_returns_the_item_at_its_added_price(
        self, client: TestClient, superuser_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)
        added_price = item.price_cents
        item.price_cents = 1_500  # what a check off the wrong page left behind
        item.previous_price_cents = added_price
        item.lowest_price_cents = 1_500
        db.add(item)
        db.commit()

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/restart",
            headers=superuser_token_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["price_cents"] == added_price
        assert body["price_tracking"]["lowest_price_cents"] == added_price
        assert body["price_tracking"]["previous_price_cents"] is None
        assert body["price_tracking"]["enabled"] is True

    def test_restart_requires_ownership(
        self, client: TestClient, normal_user_token_headers: dict[str, str], db: Session
    ) -> None:
        item = superuser_item(db)

        response = client.post(
            f"{settings.API_V1_STR}/price-tracking/{item.id}/restart",
            headers=normal_user_token_headers,
        )

        assert response.status_code == 403
