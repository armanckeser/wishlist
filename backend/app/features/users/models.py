"""User models for authentication and user management."""

import uuid
from enum import Enum
from typing import TYPE_CHECKING, Optional

from pydantic import EmailStr
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.budget.models import Budget
    from app.features.category.models import Category
    from app.features.notification.models import Notification
    from app.features.push.models import PushSubscription
    from app.features.wishlist_item.models import WishlistItem


class WishlistVisibility(str, Enum):
    """Visibility setting for a user's wishlist."""

    PRIVATE = "private"
    PUBLIC = "public"


class UserBase(SQLModel):
    """Shared user properties."""

    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    wishlist_visibility: WishlistVisibility = Field(default=WishlistVisibility.PRIVATE)


class UserCreate(UserBase):
    """Properties to receive via API on creation."""

    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    """Properties for user self-registration."""

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserUpdate(UserBase):
    """Properties to receive via API on update, all are optional."""

    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    """Properties for user to update their own profile."""

    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    wishlist_visibility: WishlistVisibility | None = None


class UpdatePassword(SQLModel):
    """Request body for password update."""

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class User(UserBase, table=True):
    """Database model for users."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    budget: Optional["Budget"] = Relationship(
        back_populates="user", cascade_delete=True
    )
    wishlist_items: list["WishlistItem"] = Relationship(
        back_populates="owner",
        cascade_delete=True,
        sa_relationship_kwargs={"foreign_keys": "WishlistItem.owner_id"},
    )
    categories: list["Category"] = Relationship(
        back_populates="owner", cascade_delete=True
    )
    notifications: list["Notification"] = Relationship(
        back_populates="user", cascade_delete=True
    )
    push_subscriptions: list["PushSubscription"] = Relationship(
        back_populates="user", cascade_delete=True
    )


class UserPublic(UserBase):
    """User response model for API."""

    id: uuid.UUID


class UsersPublic(SQLModel):
    """Paginated list of users."""

    data: list[UserPublic]
    count: int
