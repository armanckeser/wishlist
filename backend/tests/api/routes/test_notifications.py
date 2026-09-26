"""Tests for notification endpoints and service.

Abed would definitely have notifications enabled to track
when his Inspector Spacetime DVDs arrive.
"""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.features.notification.models import NotificationType
from app.features.notification.service import (
    create_notification,
    get_notifications,
    get_unread_count,
    mark_all_as_read,
    mark_as_read,
)


class TestNotificationEndpoints:
    """Tests for notification API endpoints."""

    def test_list_notifications_requires_auth(self, client: TestClient) -> None:
        """GET /notifications requires authentication."""
        response = client.get(f"{settings.API_V1_STR}/notifications/")
        assert response.status_code == 401

    def test_list_notifications_returns_user_notifications(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        session: Session,
    ) -> None:
        """GET /notifications returns notifications for current user."""
        # First get current user to create notification for them
        user_response = client.get(
            f"{settings.API_V1_STR}/users/me",
            headers=normal_user_token_headers,
        )
        user_id = uuid.UUID(user_response.json()["id"])

        # Create a notification
        create_notification(
            session,
            user_id=user_id,
            notification_type=NotificationType.GIFT_RECEIVED,
            title="Cool. Cool cool cool.",
            message="Someone got you a gift!",
            send_push=False,
        )

        response = client.get(
            f"{settings.API_V1_STR}/notifications/",
            headers=normal_user_token_headers,
        )
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "count" in data
        assert "unread_count" in data
        assert data["count"] >= 1

    def test_unread_count_endpoint(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
    ) -> None:
        """GET /notifications/unread-count returns count."""
        response = client.get(
            f"{settings.API_V1_STR}/notifications/unread-count",
            headers=normal_user_token_headers,
        )
        assert response.status_code == 200
        assert "count" in response.json()

    def test_mark_notification_read(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
        session: Session,
    ) -> None:
        """POST /notifications/{id}/read marks notification as read."""
        # Get user
        user_response = client.get(
            f"{settings.API_V1_STR}/users/me",
            headers=normal_user_token_headers,
        )
        user_id = uuid.UUID(user_response.json()["id"])

        # Create notification
        notification = create_notification(
            session,
            user_id=user_id,
            notification_type=NotificationType.BUDGET_MILESTONE,
            title="Pop pop!",
            message="You hit a budget milestone!",
            send_push=False,
        )

        # Mark as read
        response = client.post(
            f"{settings.API_V1_STR}/notifications/{notification.id}/read",
            headers=normal_user_token_headers,
        )
        assert response.status_code == 200
        assert response.json()["read_at"] is not None

    def test_mark_all_read_endpoint(
        self,
        client: TestClient,
        normal_user_token_headers: dict[str, str],
    ) -> None:
        """POST /notifications/read-all marks all as read."""
        response = client.post(
            f"{settings.API_V1_STR}/notifications/read-all",
            headers=normal_user_token_headers,
        )
        assert response.status_code == 200
        assert "message" in response.json()


class TestNotificationServiceFunctions:
    """Tests for notification service layer."""

    def test_create_notification(self, session: Session) -> None:
        """create_notification() creates notification correctly."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="annie@greendale.edu",
                password="annie_edison",
            ),
        )

        notification = create_notification(
            session,
            user_id=user.id,
            notification_type=NotificationType.GIFT_RECEIVED,
            title="Someone got you a gift!",
            message="Open the app to see what it is.",
            payload={"item_id": str(uuid.uuid4())},
            send_push=False,
        )

        assert notification.id is not None
        assert notification.user_id == user.id
        assert notification.title == "Someone got you a gift!"
        assert notification.read_at is None

    def test_get_notifications_pagination(self, session: Session) -> None:
        """get_notifications() returns paginated results."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="britta@greendale.edu",
                password="the_worst",
            ),
        )

        # Create multiple notifications
        for i in range(5):
            create_notification(
                session,
                user_id=user.id,
                notification_type=NotificationType.BUDGET_MILESTONE,
                title=f"Milestone {i}",
                message=f"You hit milestone {i}!",
                send_push=False,
            )

        notifications, count, unread = get_notifications(
            session, user.id, limit=3, offset=0
        )

        assert len(notifications) == 3
        assert count == 5
        assert unread == 5

    def test_get_unread_count(self, session: Session) -> None:
        """get_unread_count() returns correct count."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="chang@greendale.edu",
                password="changnesia",
            ),
        )

        # Create some notifications
        for i in range(3):
            create_notification(
                session,
                user_id=user.id,
                notification_type=NotificationType.FREEZE_EXPIRING,
                title=f"Freeze {i}",
                message="Your freeze is expiring!",
                send_push=False,
            )

        count = get_unread_count(session, user.id)
        assert count == 3

    def test_mark_as_read_updates_read_at(self, session: Session) -> None:
        """mark_as_read() sets read_at timestamp."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="dean@greendale.edu",
                password="dean_dean_dean",
            ),
        )

        notification = create_notification(
            session,
            user_id=user.id,
            notification_type=NotificationType.GIFT_RECEIVED,
            title="Dean-lightful!",
            message="Someone dean-livered a gift!",
            send_push=False,
        )

        assert notification.read_at is None

        updated = mark_as_read(session, notification.id, user.id)
        assert updated.read_at is not None

    def test_mark_all_as_read(self, session: Session) -> None:
        """mark_all_as_read() marks all user notifications as read."""
        from app.features.users.models import UserCreate
        from app.features.users.service import create_user

        user = create_user(
            session=session,
            user_create=UserCreate(
                email="hickey@greendale.edu",
                password="buzz_hickey",
            ),
        )

        # Create notifications
        for i in range(3):
            create_notification(
                session,
                user_id=user.id,
                notification_type=NotificationType.BUDGET_MILESTONE,
                title=f"Milestone {i}",
                message="Budget milestone!",
                send_push=False,
            )

        # All should be unread
        assert get_unread_count(session, user.id) == 3

        # Mark all as read
        count = mark_all_as_read(session, user.id)
        assert count == 3

        # All should now be read
        assert get_unread_count(session, user.id) == 0
