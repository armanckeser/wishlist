"""Category models for categorizing wishlist items."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.users.models import User
    from app.features.wishlist_item.models import WishlistItem


class ItemCategory(SQLModel, table=True):
    """Link table for many-to-many relationship between items and categories."""

    item_id: uuid.UUID = Field(
        foreign_key="wishlistitem.id", primary_key=True, ondelete="CASCADE"
    )
    category_id: uuid.UUID = Field(
        foreign_key="category.id", primary_key=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=func.now()
        ),
    )


class CategoryBase(SQLModel):
    """Shared category properties."""

    name: str = Field(min_length=1, max_length=100)
    parent_id: uuid.UUID | None = Field(default=None, foreign_key="category.id")


class CategoryCreate(SQLModel):
    """Properties to receive on category creation."""

    name: str = Field(min_length=1, max_length=100)
    parent_id: uuid.UUID | None = None


class CategoryUpdate(SQLModel):
    """Properties to receive on category update."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: uuid.UUID | None = None


class Category(CategoryBase, table=True):
    """Database model for categories."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    owner: Optional["User"] = Relationship(back_populates="categories")
    parent: Optional["Category"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "Category.id"},
    )
    children: list["Category"] = Relationship(back_populates="parent")
    items: list["WishlistItem"] = Relationship(
        back_populates="categories", link_model=ItemCategory
    )


class CategoryPublic(SQLModel):
    """API response for a category."""

    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    created_at: datetime


class CategoriesPublic(SQLModel):
    """List of categories."""

    data: list[CategoryPublic]
    count: int


DEFAULT_CATEGORIES = [
    "Skincare",
    "Fragrance",
    "Jewelry",
    "Clothing",
    "Accessories",
    "Home",
]


class CategorySuggestionRequest(SQLModel):
    """Request for category suggestions."""

    product_url: str | None = None
    title: str | None = None
    breadcrumbs: list[str] | None = None
    brand: str | None = None
    category: str | None = None  # From structured data


class CategorySuggestionPublic(SQLModel):
    """A suggested category."""

    category_id: uuid.UUID
    category_name: str
    confidence: float
    source: str


class CategorySuggestionsPublic(SQLModel):
    """Response for category suggestions."""

    suggestions: list[CategorySuggestionPublic]
