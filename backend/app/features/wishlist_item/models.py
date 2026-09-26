"""WishlistItem models for managing wishlisted products."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Annotated, Literal, Optional

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

from app.features.budget.models import CooloffSettingsPublic
from app.features.category.models import CategoryPublic, ItemCategory
from app.features.price_tracking.models import PriceTrackingPublic
from app.features.tracking.models import DeliveryStatus, TrackingEventPublic

if TYPE_CHECKING:
    from app.features.category.models import Category
    from app.features.users.models import User


class WishlistItemStatus(str, Enum):
    """Status of a wishlist item."""

    WISHLISTED = "wishlisted"
    PURCHASED = "purchased"
    GIFTED = "gifted"
    ARCHIVED = "archived"
    TRACKING = "tracking"


class WishlistItemBase(SQLModel):
    """Shared wishlist item properties."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price_cents: int = Field(ge=0)
    image_url: str | None = Field(default=None, max_length=2048)
    product_url: str | None = Field(default=None, max_length=2048)


class WishlistItemCreate(WishlistItemBase):
    """Properties to receive on wishlist item creation."""

    category_ids: list[uuid.UUID] = Field(default_factory=list)
    # Tracking fields (for creating items in TRACKING status)
    tracking_number: str | None = Field(default=None, max_length=100)
    tracking_carrier: str | None = Field(default=None, max_length=100)
    tracking_url: str | None = Field(default=None, max_length=2048)
    # True when price_cents came straight from parsing product_url. This is the
    # guardrail for automatic price tracking: we only track pages we have
    # already pulled a price from.
    price_from_url: bool = Field(default=False)


class WishlistItemUpdate(SQLModel):
    """Properties to receive on wishlist item update."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    price_cents: int | None = Field(default=None, ge=0)
    image_url: str | None = Field(default=None, max_length=2048)
    product_url: str | None = Field(default=None, max_length=2048)
    category_ids: list[uuid.UUID] | None = Field(default=None)
    # Tracking fields (can be added/updated after purchase)
    tracking_number: str | None = Field(default=None, max_length=100)
    tracking_carrier: str | None = Field(default=None, max_length=100)
    tracking_url: str | None = Field(default=None, max_length=2048)


class WishlistItem(WishlistItemBase, table=True):
    """Database model for wishlist items."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    added_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    status: WishlistItemStatus = Field(default=WishlistItemStatus.WISHLISTED)
    purchased_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Undo tracking - stores reason when purchase is undone
    undo_reason: str | None = Field(default=None, max_length=500)
    undone_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Archive tracking
    archived_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Cooldown waiver tracking
    cooldown_waived_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Most desired item designation - only one per user
    is_most_desired: bool = Field(default=False)
    # Purchase tracking
    tracking_url: str | None = Field(default=None, max_length=2048)
    actual_price_paid_cents: int | None = Field(default=None, ge=0)
    # Gift tracking
    bought_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    gift_message: str | None = Field(default=None, max_length=500)
    gifter_display_name: str | None = Field(default=None, max_length=100)
    gifted_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Package tracking fields
    tracking_number: str | None = Field(default=None, max_length=100)
    tracking_carrier: str | None = Field(default=None, max_length=100)
    tracking_data: dict | None = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    tracking_synced_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    estimated_delivery_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Automatic price tracking (see app.features.price_tracking)
    price_tracking_enabled: bool = Field(
        default=False, sa_column_kwargs={"server_default": "false"}
    )
    # Last time a price was successfully extracted from product_url.
    # Non-null means the page is eligible for tracking.
    price_verified_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # Last check attempt (success or failure)
    price_checked_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    price_check_failures: int = Field(
        default=0, sa_column_kwargs={"server_default": "0"}
    )
    # User-facing description of the most recent failure, cleared on success
    price_check_error: str | None = Field(default=None, max_length=500)
    # Machine-readable companion to price_check_error (PriceCheckFailureReason),
    # so the UI can show a one-word status and the right fix.
    price_check_reason: str | None = Field(default=None, max_length=32)
    # Title of the product page the last confirmed check saw. This is what a
    # later check is compared against to tell "same product, new price" from
    # "the link now points at something else" - the item's own title can't be
    # used for that because the owner is free to rename it.
    price_verified_title: str | None = Field(default=None, max_length=255)
    # Set when tracking was switched off automatically after repeated failures
    price_tracking_paused_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    # True when the owner explicitly turned tracking off (distinct from an
    # automatic pause, which is a retryable failure state, not a preference).
    price_tracking_disabled_by_user: bool = Field(
        default=False, sa_column_kwargs={"server_default": "false"}
    )
    # Price summary, kept in sync with PricePoint rows
    original_price_cents: int | None = Field(default=None, ge=0)
    lowest_price_cents: int | None = Field(default=None, ge=0)
    previous_price_cents: int | None = Field(default=None, ge=0)
    price_changed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    owner: Optional["User"] = Relationship(
        back_populates="wishlist_items",
        sa_relationship_kwargs={"foreign_keys": "[WishlistItem.owner_id]"},
    )
    categories: list["Category"] = Relationship(
        back_populates="items", link_model=ItemCategory
    )


class WishlistedItemPublic(WishlistItemBase):
    """API response for a wishlisted item."""

    id: uuid.UUID
    owner_id: uuid.UUID
    added_at: datetime
    status: Literal["wishlisted"]
    is_most_desired: bool = False
    categories: list[CategoryPublic] = []
    cooldown_waived_at: datetime | None = None
    price_tracking: PriceTrackingPublic | None = None


class PurchasedItemPublic(WishlistItemBase):
    """API response for a purchased item."""

    id: uuid.UUID
    owner_id: uuid.UUID
    added_at: datetime
    status: Literal["purchased"]
    purchased_at: datetime
    is_most_desired: bool = False
    categories: list[CategoryPublic] = []
    tracking_url: str | None = None
    actual_price_paid_cents: int | None = None
    # Tracking fields (optional, when tracking_number is set)
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    estimated_delivery_at: datetime | None = None
    tracking_synced_at: datetime | None = None
    # Derived tracking status (from tracking_data if synced)
    tracking_status: DeliveryStatus | None = None
    tracking_status_label: str | None = None
    tracking_events: list[TrackingEventPublic] = []


class ArchivedItemPublic(WishlistItemBase):
    """API response for an archived item."""

    id: uuid.UUID
    owner_id: uuid.UUID
    added_at: datetime
    status: Literal["archived"]
    archived_at: datetime
    is_most_desired: bool = False
    categories: list[CategoryPublic] = []


class GiftedItemPublic(WishlistItemBase):
    """API response for a gifted item."""

    id: uuid.UUID
    owner_id: uuid.UUID
    added_at: datetime
    status: Literal["gifted"]
    gifted_at: datetime
    bought_by_id: uuid.UUID
    gifter_display_name: str | None = None
    gift_message: str | None = None
    tracking_url: str | None = None
    is_most_desired: bool = False
    categories: list[CategoryPublic] = []
    # Tracking fields (optional, when tracking_number is set)
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    estimated_delivery_at: datetime | None = None
    tracking_synced_at: datetime | None = None
    # Derived tracking status (from tracking_data if synced)
    tracking_status: DeliveryStatus | None = None
    tracking_status_label: str | None = None
    tracking_events: list[TrackingEventPublic] = []


class TrackedItemPublic(WishlistItemBase):
    """API response for a tracked item (not from wishlist)."""

    id: uuid.UUID
    owner_id: uuid.UUID
    added_at: datetime
    status: Literal["tracking"]
    is_most_desired: bool = False
    categories: list[CategoryPublic] = []
    # Tracking fields
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    tracking_url: str | None = None
    estimated_delivery_at: datetime | None = None
    tracking_synced_at: datetime | None = None
    # Derived tracking status (from tracking_data if synced)
    tracking_status: DeliveryStatus | None = None
    tracking_status_label: str | None = None
    tracking_events: list[TrackingEventPublic] = []


WishlistItemPublic = Annotated[
    WishlistedItemPublic
    | PurchasedItemPublic
    | GiftedItemPublic
    | ArchivedItemPublic
    | TrackedItemPublic,
    Field(discriminator="status"),
]


class WishlistItemsPublic(SQLModel):
    """Paginated list of wishlist items."""

    data: list[
        WishlistedItemPublic
        | PurchasedItemPublic
        | GiftedItemPublic
        | ArchivedItemPublic
        | TrackedItemPublic
    ]
    count: int


class UndoDestination(str, Enum):
    """Where to move an item when undoing purchase/gift."""

    WISHLIST = "wishlist"
    ARCHIVE = "archive"


class UndoRequest(SQLModel):
    """
    Unified request to undo a purchase or gift.

    Supports flexible handling:
    - Choose destination (wishlist or archive)
    - Specify refund amount (None = item price, 0 = no refund, or custom amount)
    """

    destination: UndoDestination = Field(
        default=UndoDestination.WISHLIST,
        description="Where to move the item: wishlist or archive",
    )
    refund_cents: int | None = Field(
        default=None,
        ge=0,
        description="Amount to refund. None = item price, 0 = no refund, or specify amount",
    )
    reason: str | None = Field(default=None, max_length=500)


class PurchaseRequest(SQLModel):
    """Optional data when marking item as purchased."""

    tracking_url: str | None = Field(default=None, max_length=2048)
    actual_price_paid_cents: int | None = Field(default=None, ge=0)
    tracking_number: str | None = Field(default=None, max_length=100)
    tracking_carrier: str | None = Field(default=None, max_length=100)


class GiftRequest(SQLModel):
    """Data when gifting an item to someone."""

    gift_message: str | None = Field(default=None, max_length=500)
    gifter_display_name: str | None = Field(default=None, max_length=100)
    tracking_url: str | None = Field(default=None, max_length=2048)


class BulkDeleteRequest(SQLModel):
    """Request to delete multiple items at once."""

    item_ids: list[uuid.UUID] = Field(min_length=1)


class BulkSetCategoriesRequest(SQLModel):
    """Request to set categories on multiple items at once."""

    item_ids: list[uuid.UUID] = Field(min_length=1)
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class BulkArchiveRequest(SQLModel):
    """Request to archive multiple items at once."""

    item_ids: list[uuid.UUID] = Field(min_length=1)


class WaiveCooldownRequest(SQLModel):
    """Request to waive cooldown period on a wishlist item."""

    reason: str = Field(min_length=1, max_length=500)


class WishlistWithSettingsPublic(SQLModel):
    """Wishlist items with owner's cooloff settings for shared wishlist viewing."""

    data: list[
        WishlistedItemPublic
        | PurchasedItemPublic
        | GiftedItemPublic
        | ArchivedItemPublic
        | TrackedItemPublic
    ]
    count: int
    owner_cooloff_settings: CooloffSettingsPublic
