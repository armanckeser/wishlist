"""Budget service for calculating and managing user budgets."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.features.budget.models import Budget, BudgetUpdate

SECONDS_PER_MONTH = 30 * 24 * 60 * 60  # Approximate month in seconds
DEFAULT_FREEZE_PENALTY_DAYS = 7


def is_budget_frozen(budget: Budget) -> bool:
    """Check if budget is currently frozen (has stashed rate)."""
    return budget.stashed_monthly_rate_cents is not None


def check_and_unfreeze(session: Session, budget: Budget) -> Budget:
    """Check if freeze has expired and unfreeze if so.

    This is called lazily on any budget read. If the current time is past
    freeze_until, we restore the original rate and resume accrual from
    the freeze end time.

    Args:
        session: Database session
        budget: Budget to check

    Returns:
        Budget (possibly unfrozen)
    """
    if not is_budget_frozen(budget):
        return budget

    now = datetime.now(timezone.utc)
    freeze_until = budget.freeze_until

    # Handle naive datetime
    if freeze_until is not None and freeze_until.tzinfo is None:
        freeze_until = freeze_until.replace(tzinfo=timezone.utc)

    # Still frozen
    if freeze_until is None or now <= freeze_until:
        return budget

    # Freeze expired - restore rate and resume accrual from freeze end
    budget.monthly_rate_cents = budget.stashed_monthly_rate_cents or 0
    budget.stashed_monthly_rate_cents = None
    budget.last_updated_at = freeze_until  # Accrual resumes from unfreeze time
    budget.freeze_until = None

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def apply_freeze(
    session: Session,
    budget: Budget,
    freeze_days: int = DEFAULT_FREEZE_PENALTY_DAYS,
) -> Budget:
    """Apply a freeze penalty to the budget.

    Flushes current accrued value, sets rate to 0, and stashes the original rate.
    If already frozen, extends freeze to the later end date.

    Args:
        session: Database session
        budget: Budget to freeze
        freeze_days: Number of days to freeze

    Returns:
        Updated frozen budget
    """
    now = datetime.now(timezone.utc)
    new_freeze_until = now + timedelta(days=freeze_days)

    # If already frozen, extend to later date (don't stack)
    if is_budget_frozen(budget):
        current_freeze = budget.freeze_until
        if current_freeze is not None:
            if current_freeze.tzinfo is None:
                current_freeze = current_freeze.replace(tzinfo=timezone.utc)
            if current_freeze > new_freeze_until:
                new_freeze_until = current_freeze
        budget.freeze_until = new_freeze_until
        session.add(budget)
        session.commit()
        session.refresh(budget)
        return budget

    # Not frozen - flush and freeze
    current_cents = calculate_current_cents(budget, now)
    budget.cents_at_last_update = current_cents
    budget.last_updated_at = now
    budget.stashed_monthly_rate_cents = budget.monthly_rate_cents
    budget.monthly_rate_cents = 0
    budget.freeze_until = new_freeze_until

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def calculate_required_cooloff_days(budget: Budget, price_cents: int) -> int:
    """Calculate required cool-off period in days based on item price and settings.

    The cool-off is the maximum of:
    1. Base cool-off (applies to all items)
    2. Price-based scaling: (price / price_per_days) * days_per_price
    3. Minimum threshold: if price > threshold, apply threshold_days

    Args:
        budget: Budget with cool-off settings
        price_cents: Item price in cents

    Returns:
        Required cool-off period in days
    """
    cooloff_days = budget.cooloff_base_days

    # Price-based scaling: "For every $X, add Y days"
    # Example: scaling_cents=10000 ($100), scaling_days=3 → $300 item needs 9 days
    if budget.cooloff_scaling_cents and budget.cooloff_scaling_cents > 0:
        price_units = price_cents / budget.cooloff_scaling_cents
        scaled_days = int(price_units * budget.cooloff_scaling_days)
        cooloff_days = max(cooloff_days, scaled_days)

    # Minimum threshold: "Items over $X need at least Y days"
    threshold_cents = budget.cooloff_min_threshold_cents
    if threshold_cents and price_cents >= threshold_cents:
        cooloff_days = max(cooloff_days, budget.cooloff_min_threshold_days)

    # Apply maximum cap if set
    if budget.cooloff_max_days is not None:
        cooloff_days = min(cooloff_days, budget.cooloff_max_days)

    return cooloff_days


def is_purchase_impulsive(
    budget: Budget,
    item_added_at: datetime,
    item_price_cents: int,
    cooldown_waived_at: datetime | None = None,
) -> bool:
    """Check if purchasing this item would be considered impulsive.

    An item is impulsive if it hasn't been on the wishlist long enough
    based on the cool-off settings.

    Args:
        budget: Budget with cool-off settings
        item_added_at: When the item was added to wishlist
        item_price_cents: Price of the item in cents
        cooldown_waived_at: Optional timestamp when cooldown was waived

    Returns:
        True if purchase would be impulsive (violates cool-off period)
    """
    # If cooldown was waived, never consider it impulsive
    if cooldown_waived_at is not None:
        return False

    required_days = calculate_required_cooloff_days(budget, item_price_cents)

    # No cool-off configured
    if required_days <= 0:
        return False

    now = datetime.now(timezone.utc)
    added_at = item_added_at
    if added_at.tzinfo is None:
        added_at = added_at.replace(tzinfo=timezone.utc)

    time_on_wishlist = now - added_at
    required_duration = timedelta(days=required_days)

    return time_on_wishlist < required_duration


def manual_unfreeze(session: Session, budget: Budget) -> Budget:
    """Manually unfreeze the budget immediately.

    Restores the original rate and clears freeze state.
    Accrual resumes from now (no retroactive accrual during freeze).

    Args:
        session: Database session
        budget: Budget to unfreeze

    Returns:
        Updated unfrozen budget
    """
    if not is_budget_frozen(budget):
        return budget

    now = datetime.now(timezone.utc)

    # Restore rate and clear freeze state
    budget.monthly_rate_cents = budget.stashed_monthly_rate_cents or 0
    budget.stashed_monthly_rate_cents = None
    budget.last_updated_at = now  # Accrual resumes from now
    budget.freeze_until = None

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def calculate_accrued_cents(budget: Budget, now: datetime) -> int:
    """Calculate cents accrued since last update based on monthly rate."""
    last_updated = budget.last_updated_at
    # If naive datetime (no tzinfo), assume it's UTC
    if last_updated.tzinfo is None:
        last_updated = last_updated.replace(tzinfo=timezone.utc)
    elapsed_seconds = (now - last_updated).total_seconds()
    cents_per_second = budget.monthly_rate_cents / SECONDS_PER_MONTH
    return int(elapsed_seconds * cents_per_second)


def calculate_current_cents(budget: Budget, now: datetime | None = None) -> int:
    """Calculate the current budget amount including accrued value."""
    if now is None:
        now = datetime.now(timezone.utc)
    accrued = calculate_accrued_cents(budget, now)
    return budget.cents_at_last_update + accrued


def get_budget_by_user_id(session: Session, user_id: uuid.UUID) -> Budget | None:
    """Get a user's budget."""
    statement = select(Budget).where(Budget.user_id == user_id)
    return session.exec(statement).first()


def get_or_create_budget(session: Session, user_id: uuid.UUID) -> Budget:
    """Get a user's budget or create one with defaults if it doesn't exist.

    Also performs lazy unfreeze check - if budget was frozen and freeze
    has expired, this will restore the original rate.
    """
    budget = get_budget_by_user_id(session, user_id)
    if budget is None:
        budget = Budget(user_id=user_id)
        session.add(budget)
        session.commit()
        session.refresh(budget)
        return budget

    # Check if freeze has expired and unfreeze if needed
    return check_and_unfreeze(session, budget)


def flush_and_update_budget(
    session: Session,
    budget: Budget,
    budget_update: BudgetUpdate,
) -> Budget:
    """
    Flush accrued value to the stored amount, then apply updates.

    This ensures we don't lose accumulated value when changing rate or amount.
    """
    now = datetime.now(timezone.utc)

    # Flush: add accrued value to the stored amount
    budget.cents_at_last_update = calculate_current_cents(budget, now)
    budget.last_updated_at = now

    # Apply updates
    update_data = budget_update.model_dump(exclude_unset=True)
    budget.sqlmodel_update(update_data)

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def deduct_from_budget(
    session: Session,
    budget: Budget,
    amount_cents: int,
) -> Budget:
    """
    Deduct an amount from the budget.

    Flushes accrued value first, then subtracts the amount.
    Budget can go negative if amount exceeds current balance.
    Returns the updated budget.
    """
    now = datetime.now(timezone.utc)

    # Calculate current total (stored + accrued)
    current_cents = calculate_current_cents(budget, now)

    # Deduct - can result in negative balance
    budget.cents_at_last_update = current_cents - amount_cents
    budget.last_updated_at = now

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


def add_to_budget(
    session: Session,
    budget: Budget,
    amount_cents: int,
) -> Budget:
    """
    Add an amount to the budget (refund).

    Flushes accrued value first, then adds the amount.
    Used when undoing a purchase.
    Returns the updated budget.
    """
    now = datetime.now(timezone.utc)

    # Calculate current total (stored + accrued)
    current_cents = calculate_current_cents(budget, now)

    # Add the refund
    budget.cents_at_last_update = current_cents + amount_cents
    budget.last_updated_at = now

    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget
