"""Notification service for database operations."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlmodel import Session, col, func, select

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.features.notification.models import (
    Notification,
    NotificationPublic,
    NotificationType,
)
from app.features.push.service import send_push_notification

logger = logging.getLogger(__name__)


def _get_notification_url(
    notification_type: NotificationType,
    payload: dict[str, Any] | None,
) -> str | None:
    """Get the URL to navigate to when notification is clicked."""
    if notification_type == NotificationType.GIFT_RECEIVED:
        item_id = payload.get("item_id") if payload else None
        if item_id:
            return f"/?item={item_id}"
        return "/"
    if notification_type == NotificationType.FREEZE_EXPIRING:
        return "/settings"
    if notification_type == NotificationType.BUDGET_MILESTONE:
        return "/"
    # Tracking notifications - link to tracking page
    if notification_type.value.startswith("delivery_"):
        return "/tracking"
    # Price tracking notifications - open the item
    if notification_type.value.startswith("price_"):
        item_id = payload.get("item_id") if payload else None
        return f"/?item={item_id}" if item_id else "/"
    return None


def create_notification(
    session: Session,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    payload: dict[str, Any] | None = None,
    send_push: bool = True,
    image_url: str | None = None,
) -> Notification | None:
    """Create a new notification for a user with deduplication.

    Args:
        session: Database session.
        user_id: User to notify.
        notification_type: Type of notification.
        title: Notification title.
        message: Notification message.
        payload: Optional metadata payload.
        send_push: Whether to also send a push notification.
        image_url: Optional image URL for push notification.

    Returns:
        The created notification, or None if deduplicated.
    """
    # Deduplicate delivery notifications by item_id within 5 minutes
    if notification_type.value.startswith("delivery_") and payload:
        item_id = payload.get("item_id")
        if item_id:
            recent_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
            existing = session.exec(
                select(Notification)
                .where(Notification.user_id == user_id)
                .where(Notification.notification_type == notification_type)
                .where(col(Notification.created_at) > recent_cutoff)
                .where(Notification.payload["item_id"].as_string() == item_id)
            ).first()

            if existing:
                logger.warning(
                    "Skipping duplicate %s notification for item %s (existing: %s)",
                    notification_type.value,
                    item_id,
                    existing.id,
                )
                return None

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        payload=payload,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)

    if send_push and settings.push_enabled:
        url = _get_notification_url(notification_type, payload)
        send_push_notification(
            session,
            user_id,
            title,
            message,
            url=url,
            tag=f"{notification_type.value}-{notification.id}",
            image=image_url,
        )

    return notification


def get_notifications(
    session: Session,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Notification], int, int]:
    """
    Get notifications for a user with pagination.

    Returns: tuple of (notifications, total_count, unread_count)
    """
    count_statement = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id)
    )
    count = session.exec(count_statement).one()

    unread_statement = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id)
        .where(col(Notification.read_at).is_(None))
    )
    unread_count = session.exec(unread_statement).one()

    statement = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(col(Notification.created_at).desc())
        .offset(offset)
        .limit(limit)
    )
    notifications = list(session.exec(statement).all())

    return notifications, count, unread_count


def get_unread_count(
    session: Session,
    user_id: uuid.UUID,
) -> int:
    """Get count of unread notifications for a user."""
    statement = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id)
        .where(col(Notification.read_at).is_(None))
    )
    return session.exec(statement).one()


def mark_as_read(
    session: Session,
    notification_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Notification:
    """
    Mark a notification as read.

    Raises:
        NotFoundError: If notification doesn't exist or doesn't belong to user.
    """
    notification = session.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        raise NotFoundError("Notification")

    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        session.add(notification)
        session.commit()
        session.refresh(notification)

    return notification


def mark_all_as_read(
    session: Session,
    user_id: uuid.UUID,
) -> int:
    """
    Mark all notifications as read for a user.

    Returns: count of notifications marked as read
    """
    now = datetime.now(timezone.utc)
    statement = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .where(col(Notification.read_at).is_(None))
    )
    notifications = list(session.exec(statement).all())

    for notification in notifications:
        notification.read_at = now
        session.add(notification)

    session.commit()
    return len(notifications)


def notification_to_public(notification: Notification) -> NotificationPublic:
    """Convert a Notification to its public representation."""
    return NotificationPublic(
        id=notification.id,
        user_id=notification.user_id,
        notification_type=notification.notification_type,
        title=notification.title,
        message=notification.message,
        created_at=notification.created_at,
        read_at=notification.read_at,
        payload=notification.payload,
    )
