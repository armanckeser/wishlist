"""Budget models for tracking user spending allowance."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.features.users.models import User


class BudgetBase(SQLModel):
    """Shared budget properties."""

    cents_at_last_update: int = Field(default=0)  # Can go negative (over-budget)
    monthly_rate_cents: int = Field(default=60000, ge=0)  # $600/month default

    # Freeze mechanism: when stashed_rate is set, budget is frozen (rate=0)
    freeze_until: datetime | None = Field(default=None)
    stashed_monthly_rate_cents: int | None = Field(default=None)
    freeze_penalty_days: int = Field(default=7, ge=0)  # Days to freeze on impulsive buy

    # Cool-off settings: encourage delayed gratification by requiring wait time
    #
    # Price-based scaling: "For every $X, require Y extra days of cool-off"
    # Example: scaling_cents=10000 ($100), scaling_days=3 → $300 item needs 9 days
    cooloff_scaling_cents: int | None = Field(default=None, ge=0)
    cooloff_scaling_days: int = Field(default=3, ge=0)
    #
    # Minimum threshold: "Items over $X need at least Y days cool-off"
    # Example: threshold_cents=20000 ($200), threshold_days=7 → $250 item needs 7+ days
    cooloff_min_threshold_cents: int | None = Field(default=None, ge=0)
    cooloff_min_threshold_days: int = Field(default=7, ge=0)
    #
    # Base cool-off: minimum wait for all items regardless of price
    # Example: base_days=1 → all items need at least 1 day before purchase
    cooloff_base_days: int = Field(default=0, ge=0)
    #
    # Maximum cool-off: cap on total cool-off time regardless of price
    # Example: max_days=30 → no item needs more than 30 days regardless of price
    cooloff_max_days: int | None = Field(default=None, ge=0)


class BudgetUpdate(SQLModel):
    """Properties to receive on budget update."""

    cents_at_last_update: int | None = Field(default=None)  # Can go negative
    monthly_rate_cents: int | None = Field(default=None, ge=0)

    # Freeze fields (usually managed by system, not user)
    freeze_until: datetime | None = Field(default=None)
    stashed_monthly_rate_cents: int | None = Field(default=None)
    freeze_penalty_days: int | None = Field(default=None, ge=0)

    # Cool-off settings (user configurable)
    cooloff_scaling_cents: int | None = Field(default=None, ge=0)
    cooloff_scaling_days: int | None = Field(default=None, ge=0)
    cooloff_min_threshold_cents: int | None = Field(default=None, ge=0)
    cooloff_min_threshold_days: int | None = Field(default=None, ge=0)
    cooloff_base_days: int | None = Field(default=None, ge=0)
    cooloff_max_days: int | None = Field(default=None, ge=0)


class Budget(BudgetBase, table=True):
    """Database model for user budget."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", unique=True, nullable=False, ondelete="CASCADE"
    )
    last_updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    user: Optional["User"] = Relationship(back_populates="budget")


class BudgetPublic(BudgetBase):
    """Budget response - client calculates current value from rate + timestamp."""

    id: uuid.UUID
    user_id: uuid.UUID
    last_updated_at: datetime


class CooloffSettingsPublic(SQLModel):
    """Public cooloff settings for viewing shared wishlists.

    Exposes only timing settings, not balance or rate info.
    """

    cooloff_scaling_cents: int | None = None
    cooloff_scaling_days: int = 3
    cooloff_min_threshold_cents: int | None = None
    cooloff_min_threshold_days: int = 7
    cooloff_base_days: int = 0
    cooloff_max_days: int | None = None
    freeze_penalty_days: int = 7
