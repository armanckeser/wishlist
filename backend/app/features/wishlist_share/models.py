"""WishlistShare models for managing wishlist sharing between users."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.users.models import User


class WishlistShareBase(SQLModel):
    """Shared wishlist share properties."""

    pass


class WishlistShareCreate(SQLModel):
    """Properties to receive on wishlist share creation."""

    shared_with_email: str = Field(max_length=255)


class WishlistShare(WishlistShareBase, table=True):
    """Database model for wishlist shares between users."""

    __table_args__ = (
        UniqueConstraint("owner_id", "shared_with_id", name="unique_share"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    shared_with_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    owner: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WishlistShare.owner_id]"}
    )
    shared_with: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[WishlistShare.shared_with_id]"}
    )


class WishlistSharePublic(SQLModel):
    """API response for a wishlist share."""

    id: uuid.UUID
    owner_id: uuid.UUID
    shared_with_id: uuid.UUID
    shared_with_email: str
    owner_email: str
    created_at: datetime


class WishlistSharesPublic(SQLModel):
    """Paginated list of wishlist shares."""

    data: list[WishlistSharePublic]
    count: int
