"""Models for automatic price tracking.

A `PricePoint` is one successful price observation for a wishlist item.
Tracking state itself (enabled, failures, last error, summary prices) is
denormalized onto `WishlistItem` so list responses never need extra queries.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel

# Consecutive failed checks before tracking is paused automatically.
MAX_CONSECUTIVE_FAILURES = 3

# Minimum gap between manual checks for the same item.
MANUAL_CHECK_COOLDOWN_MINUTES = 10

# Items are re-checked once they haven't been checked for this long.
CHECK_INTERVAL_HOURS = 23


class PricePointSource(str, Enum):
    """How a price point was captured."""

    INITIAL = "initial"  # Seeded when the item was added / tracking enabled
    SCHEDULED = "scheduled"  # Daily background check
    MANUAL = "manual"  # User pressed "Check now"
    # Response-only: the price the item was added at, so the graph starts
    # where the item's story starts rather than at the first check.
    ADDED = "added"


class PriceCheckFailureReason(str, Enum):
    """Why a check could not be trusted. Drives the one-word UI status."""

    BLOCKED = "blocked"  # Store served a bot challenge
    UNREACHABLE = "unreachable"  # Network error / site down
    NO_PRICE = "no_price"  # Page loaded, no price on it (often sold out)
    LINK_MOVED = "link_moved"  # Redirected to a listing or another page
    DIFFERENT_PRODUCT = "different_product"  # Page is about something else
    IMPLAUSIBLE = "implausible"  # Price too far from the known one to believe
    NO_LINK = "no_link"  # Item has no product link


class PricePoint(SQLModel, table=True):
    """One successful price observation for a wishlist item."""

    __table_args__ = (Index("ix_pricepoint_item_recorded", "item_id", "recorded_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    item_id: uuid.UUID = Field(
        foreign_key="wishlistitem.id", nullable=False, ondelete="CASCADE"
    )
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    price_cents: int = Field(ge=0)
    currency: str | None = Field(default=None, max_length=8)
    source: PricePointSource = Field(default=PricePointSource.SCHEDULED)
    # True once we could prove the reading came from this item's own page.
    # Rows written before that check existed default to false in the database
    # and are dropped the first time a verified reading lands, so a graph is
    # never a mix of prices we can vouch for and prices we can't.
    verified: bool = Field(default=True, sa_column_kwargs={"server_default": "false"})


class PricePointPublic(SQLModel):
    """A single point on the price history graph."""

    recorded_at: datetime
    price_cents: int
    source: PricePointSource


class PriceTrackingPublic(SQLModel):
    """Tracking state embedded in wishlisted item responses."""

    enabled: bool
    # True when we have successfully pulled a price from product_url before.
    eligible: bool
    # True when tracking was switched off automatically after repeated failures.
    paused: bool
    # True when the owner explicitly turned tracking off for this item.
    disabled_by_user: bool = False
    last_checked_at: datetime | None = None
    last_error: str | None = None
    # Machine-readable companion to `last_error`, so the UI can show a short
    # status and offer the right fix instead of printing a sentence.
    last_error_reason: PriceCheckFailureReason | None = None
    consecutive_failures: int = 0
    original_price_cents: int | None = None
    lowest_price_cents: int | None = None
    previous_price_cents: int | None = None
    price_changed_at: datetime | None = None


class PriceHistoryPublic(SQLModel):
    """Full price history for one item (drawer graph)."""

    item_id: uuid.UUID
    current_price_cents: int
    tracking: PriceTrackingPublic
    points: list[PricePointPublic]


class PriceCheckOutcome(str, Enum):
    """Result of a single price check."""

    UNCHANGED = "unchanged"
    DROPPED = "dropped"
    INCREASED = "increased"
    FAILED = "failed"


class PriceCheckResultPublic(SQLModel):
    """Response for a manual price check.

    Failures are reported inside the body (not as HTTP errors) so the UI can
    show them inline next to the graph rather than as a generic error toast.
    """

    outcome: PriceCheckOutcome
    message: str
    reason: PriceCheckFailureReason | None = None
    checked_at: datetime
    price_cents: int | None = None
    previous_price_cents: int | None = None
    tracking: PriceTrackingPublic
