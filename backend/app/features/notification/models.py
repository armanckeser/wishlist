"""Notification models for user notifications."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.users.models import User


class NotificationType(str, Enum):
    """Types of notifications."""

    GIFT_RECEIVED = "gift_received"
    THANK_YOU = "thank_you"
    FREEZE_EXPIRING = "freeze_expiring"
    BUDGET_MILESTONE = "budget_milestone"
    # Tracking notifications (all delivery status changes)
    DELIVERY_INFO_RECEIVED = "delivery_info_received"
    DELIVERY_IN_TRANSIT = "delivery_in_transit"
    DELIVERY_OUT_FOR_DELIVERY = "delivery_out_for_delivery"
    DELIVERY_DELIVERED = "delivery_delivered"
    DELIVERY_EXCEPTION = "delivery_exception"
    DELIVERY_EXPIRED = "delivery_expired"
    # Price tracking notifications
    PRICE_DROP = "price_drop"
    PRICE_INCREASE = "price_increase"
    PRICE_TRACKING_PAUSED = "price_tracking_paused"


class NotificationBase(SQLModel):
    """Shared notification properties."""

    notification_type: NotificationType
    title: str = Field(max_length=200)
    message: str = Field(max_length=500)


class Notification(NotificationBase, table=True):
    """Database model for notifications."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    read_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    payload: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))

    user: "User" = Relationship(back_populates="notifications")


class NotificationCreate(SQLModel):
    """Properties to receive on notification creation."""

    notification_type: NotificationType
    title: str = Field(max_length=200)
    message: str = Field(max_length=500)
    payload: dict[str, Any] | None = None


class NotificationPublic(NotificationBase):
    """API response for a notification."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    read_at: datetime | None
    payload: dict[str, Any] | None = None


class NotificationsPublic(SQLModel):
    """Paginated list of notifications."""

    data: list[NotificationPublic]
    count: int
    unread_count: int


class UnreadCountPublic(SQLModel):
    """Response for unread notification count."""

    count: int
