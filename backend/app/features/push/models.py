"""Push subscription models for web push notifications."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.users.models import User


class PushSubscriptionBase(SQLModel):
    """Shared push subscription properties."""

    endpoint: str = Field(max_length=500, index=True, unique=True)
    p256dh_key: str = Field(max_length=200)
    auth_key: str = Field(max_length=50)


class PushSubscription(PushSubscriptionBase, table=True):
    """Database model for push subscriptions."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    user: "User" = Relationship(back_populates="push_subscriptions")


class PushSubscriptionCreate(SQLModel):
    """Properties to receive on push subscription creation."""

    endpoint: str = Field(max_length=500)
    p256dh_key: str = Field(max_length=200)
    auth_key: str = Field(max_length=50)


class PushSubscriptionPublic(PushSubscriptionBase):
    """API response for a push subscription."""

    id: uuid.UUID
    created_at: datetime


class VapidKeyPublic(SQLModel):
    """API response for VAPID public key."""

    public_key: str | None
    enabled: bool
