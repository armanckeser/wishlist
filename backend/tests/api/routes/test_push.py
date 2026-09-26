"""Tests for push notification endpoints.

Troy Barnes would definitely enable push notifications to know
when Abed sends him a gift from the Dreamatorium.
"""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.push.models import PushSubscriptionCreate
from app.features.push.service import (
    get_user_subscriptions,
    subscribe,
    unsubscribe,
)


class TestVapidKeyEndpoint:
    """Tests for GET /push/vapid-key."""

    def test_get_vapid_key_returns_config(self, client: TestClient) -> None:
        """VAPID key endpoint returns current configuration."""
        response = client.get(f"{settings.API_V1_STR}/push/vapid-key")
        assert response.status_code == 200

        data = response.json()
        assert "public_key" in data
        assert "enabled" in data
        assert isinstance(data["enabled"], bool)

    def test_get_vapid_key_no_auth_required(self, client: TestClient) -> None:
        """VAPID key endpoint is public (no auth needed)."""
        # No auth headers
        response = client.get(f"{settings.API_V1_STR}/push/vapid-key")
        assert response.status_code == 200


class TestSubscribeEndpoint:
    """Tests for POST /push/subscribe."""

    def test_subscribe_requires_auth(self, client: TestClient) -> None:
        """Subscribe endpoint requires authentication."""
        response = client.post(
            f"{settings.API_V1_STR}/push/subscribe",
            json={
                "endpoint": "https://push.example.com/abc123",
                "p256dh_key": "test_p256dh_key",
                "auth_key": "test_auth_key",
            },
        )
        assert response.status_code == 401

    def test_subscribe_creates_subscription(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        session: Session,
    ) -> None:
        """Authenticated user can subscribe to push notifications."""
        endpoint = f"https://push.example.com/{uuid.uuid4()}"
        response = client.post(
            f"{settings.API_V1_STR}/push/subscribe",
            headers=normal_user_token_headers,
            json={
                "endpoint": endpoint,
                "p256dh_key": "test_p256dh_key_value",
                "auth_key": "test_auth_key_value",
            },
        )
        assert response.status_code == 200

        data = response.json()
        assert data["endpoint"] == endpoint
        assert data["p256dh_key"] == "test_p256dh_key_value"
        assert "id" in data
        assert "created_at" in data

    def test_subscribe_upserts_by_endpoint(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
    ) -> None:
        """Re-subscribing with same endpoint updates existing subscription."""
        endpoint = f"https://push.example.com/{uuid.uuid4()}"

        # First subscription
        response1 = client.post(
            f"{settings.API_V1_STR}/push/subscribe",
            headers=normal_user_token_headers,
            json={
                "endpoint": endpoint,
                "p256dh_key": "old_key",
                "auth_key": "old_auth",
            },
        )
        assert response1.status_code == 200
        first_id = response1.json()["id"]

        # Second subscription with same endpoint
        response2 = client.post(
            f"{settings.API_V1_STR}/push/subscribe",
            headers=normal_user_token_headers,
            json={
                "endpoint": endpoint,
                "p256dh_key": "new_key",
                "auth_key": "new_auth",
            },
        )
        assert response2.status_code == 200

        # Should update existing, not create new
        data = response2.json()
        assert data["id"] == first_id
        assert data["p256dh_key"] == "new_key"


class TestUnsubscribeEndpoint:
    """Tests for POST /push/unsubscribe."""

    def test_unsubscribe_requires_auth(self, client: TestClient) -> None:
        """Unsubscribe endpoint requires authentication."""
        response = client.post(
            f"{settings.API_V1_STR}/push/unsubscribe",
            params={"endpoint": "https://push.example.com/abc123"},
        )
        assert response.status_code == 401

    def test_unsubscribe_removes_subscription(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
    ) -> None:
        """Authenticated user can unsubscribe from push notifications."""
        endpoint = f"https://push.example.com/{uuid.uuid4()}"

        # First subscribe
        client.post(
            f"{settings.API_V1_STR}/push/subscribe",
            headers=normal_user_token_headers,
            json={
                "endpoint": endpoint,
                "p256dh_key": "test_key",
                "auth_key": "test_auth",
            },
        )

        # Then unsubscribe
        response = client.post(
            f"{settings.API_V1_STR}/push/unsubscribe",
            headers=normal_user_token_headers,
            params={"endpoint": endpoint},
        )
        assert response.status_code == 200
        assert "Unsubscribed" in response.json()["message"]

    def test_unsubscribe_nonexistent_returns_not_found_message(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
    ) -> None:
        """Unsubscribing from non-existent subscription returns appropriate message."""
        response = client.post(
            f"{settings.API_V1_STR}/push/unsubscribe",
            headers=normal_user_token_headers,
            params={"endpoint": "https://push.example.com/nonexistent"},
        )
        assert response.status_code == 200
        assert "not found" in response.json()["message"]


class TestPushServiceFunctions:
    """Tests for push service layer functions."""

    def test_subscribe_creates_new(self, session: Session) -> None:
        """subscribe() creates new subscription for new endpoint."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="pierce@greendale.edu",
                password="streets_ahead",
            ),
        )

        subscription_data = PushSubscriptionCreate(
            endpoint="https://push.greendale.edu/pierce",
            p256dh_key="pierce_p256dh",
            auth_key="pierce_auth",
        )

        result = subscribe(session, user.id, subscription_data)

        assert result.endpoint == subscription_data.endpoint
        assert result.user_id == user.id

    def test_unsubscribe_removes_existing(self, session: Session) -> None:
        """unsubscribe() removes existing subscription."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="shirley@greendale.edu",
                password="thats_nice",
            ),
        )

        endpoint = "https://push.greendale.edu/shirley"
        subscription_data = PushSubscriptionCreate(
            endpoint=endpoint,
            p256dh_key="shirley_p256dh",
            auth_key="shirley_auth",
        )
        subscribe(session, user.id, subscription_data)

        # Verify it exists
        subs = get_user_subscriptions(session, user.id)
        assert len(subs) == 1

        # Unsubscribe
        result = unsubscribe(session, user.id, endpoint)
        assert result is True

        # Verify it's gone
        subs = get_user_subscriptions(session, user.id)
        assert len(subs) == 0

    def test_unsubscribe_nonexistent_returns_false(self, session: Session) -> None:
        """unsubscribe() returns False for non-existent subscription."""
        result = unsubscribe(session, uuid.uuid4(), "https://nonexistent.com")
        assert result is False

    def test_get_user_subscriptions_returns_all(self, session: Session) -> None:
        """get_user_subscriptions() returns all subscriptions for user."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="jeff@greendale.edu",
                password="winger_speech",
            ),
        )

        # Add multiple subscriptions (different devices)
        for i in range(3):
            subscribe(
                session,
                user.id,
                PushSubscriptionCreate(
                    endpoint=f"https://push.greendale.edu/jeff/device{i}",
                    p256dh_key=f"jeff_p256dh_{i}",
                    auth_key=f"jeff_auth_{i}",
                ),
            )

        subs = get_user_subscriptions(session, user.id)
        assert len(subs) == 3
