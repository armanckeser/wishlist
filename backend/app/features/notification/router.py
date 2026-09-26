"""Notification routes for managing user notifications."""

import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.features.notification.models import (
    NotificationPublic,
    NotificationsPublic,
    UnreadCountPublic,
)
from app.features.notification.service import (
    get_notifications,
    get_unread_count,
    mark_all_as_read,
    mark_as_read,
    notification_to_public,
)
from app.shared.models import Message

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationsPublic)
def list_notifications(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0,
) -> NotificationsPublic:
    """Get notifications for the current user."""
    notifications, count, unread_count = get_notifications(
        session, current_user.id, limit=limit, offset=offset
    )
    return NotificationsPublic(
        data=[notification_to_public(n) for n in notifications],
        count=count,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=UnreadCountPublic)
def read_unread_count(
    session: SessionDep,
    current_user: CurrentUser,
) -> UnreadCountPublic:
    """Get count of unread notifications."""
    count = get_unread_count(session, current_user.id)
    return UnreadCountPublic(count=count)


@router.post("/{notification_id}/read", response_model=NotificationPublic)
def mark_notification_read(
    session: SessionDep,
    current_user: CurrentUser,
    notification_id: uuid.UUID,
) -> NotificationPublic:
    """Mark a notification as read."""
    notification = mark_as_read(session, notification_id, current_user.id)
    return notification_to_public(notification)


@router.post("/read-all", response_model=Message)
def mark_all_notifications_read(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Mark all notifications as read."""
    count = mark_all_as_read(session, current_user.id)
    return Message(message=f"Marked {count} notifications as read")
