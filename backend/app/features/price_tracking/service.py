"""Price tracking service.

Responsibilities:
- Decide which items may be tracked (guardrails)
- Fetch the current price of an item's product page, and refuse prices
  that came from a page which is no longer that product
- Record observations (PricePoint rows + denormalized summary on the item)
- Notify the owner on changes and when tracking gets paused

Network access is isolated in `fetch_price_observation` so the recording
and identity logic can be tested without touching the web.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from sqlmodel import Session, col, select

from app.core.exceptions import ValidationError
from app.features.notification.models import NotificationType
from app.features.notification.service import create_notification
from app.features.price_tracking.models import (
    CHECK_INTERVAL_HOURS,
    MANUAL_CHECK_COOLDOWN_MINUTES,
    MAX_CONSECUTIVE_FAILURES,
    PriceCheckFailureReason,
    PriceCheckOutcome,
    PriceCheckResultPublic,
    PriceHistoryPublic,
    PricePoint,
    PricePointPublic,
    PricePointSource,
    PriceTrackingPublic,
)
from app.features.price_tracking.verification import verify_identity
from app.features.url_parser.service import ParseError, parse_url
from app.features.wishlist_item.models import WishlistItem, WishlistItemStatus

logger = logging.getLogger(__name__)


# Prices outside this band relative to the last known price are treated as
# extraction mistakes (wrong variant, bundle price, "0.00" placeholder, ...).
MIN_PLAUSIBLE_RATIO = 0.2
MAX_PLAUSIBLE_RATIO = 5.0

# A reading this soon after the item was added is the baseline already - no
# need to draw the same price twice on the graph.
ADDED_POINT_MIN_GAP = timedelta(hours=1)

# Failures no amount of retrying will fix - the owner has to point the item
# at a working product link.
NEEDS_NEW_LINK = {
    PriceCheckFailureReason.LINK_MOVED,
    PriceCheckFailureReason.DIFFERENT_PRODUCT,
}


# =============================================================================
# Exceptions & helpers
# =============================================================================


class PriceCheckFailed(Exception):
    """A price could not be trusted. `message` is safe to show to users.

    `reason` is the machine-readable half: the UI turns it into a one-word
    status and the fix that goes with it.
    """

    def __init__(
        self,
        message: str,
        reason: PriceCheckFailureReason = PriceCheckFailureReason.UNREACHABLE,
        technical: str | None = None,
    ):
        self.message = message
        self.reason = reason
        self.technical = technical
        super().__init__(message)


class PriceObservation(NamedTuple):
    """A price we trust, and what proved it belongs to the item."""

    price_cents: int
    currency: str | None = None
    title: str | None = None
    final_url: str | None = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """Normalize DB datetimes (SQLite returns naive) to aware UTC."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def format_cents(cents: int) -> str:
    """Format cents as a compact dollar string ($120 or $119.99)."""
    if cents % 100 == 0:
        return f"${cents // 100:,}"
    return f"${cents / 100:,.2f}"


def is_price_plausible(new_price_cents: int, reference_price_cents: int) -> bool:
    """Guardrail against wildly wrong extractions."""
    if new_price_cents <= 0:
        return False
    if reference_price_cents <= 0:
        return True
    ratio = new_price_cents / reference_price_cents
    return MIN_PLAUSIBLE_RATIO <= ratio <= MAX_PLAUSIBLE_RATIO


def is_eligible(item: WishlistItem) -> bool:
    """Can this item be tracked at all?

    Only pages we have already pulled a price from are eligible - this is the
    main guardrail against pointless daily fetches of pages we can't parse.
    """
    return bool(item.product_url) and item.price_verified_at is not None


def _reason_or_none(value: str | None) -> PriceCheckFailureReason | None:
    """Read the stored reason back, tolerating values we no longer know."""
    if not value:
        return None
    try:
        return PriceCheckFailureReason(value)
    except ValueError:
        return None


def tracking_to_public(item: WishlistItem) -> PriceTrackingPublic:
    """Build the embedded tracking summary for API responses."""
    return PriceTrackingPublic(
        enabled=item.price_tracking_enabled,
        eligible=is_eligible(item),
        paused=item.price_tracking_paused_at is not None,
        disabled_by_user=item.price_tracking_disabled_by_user,
        last_checked_at=item.price_checked_at,
        last_error=item.price_check_error,
        last_error_reason=_reason_or_none(item.price_check_reason),
        consecutive_failures=item.price_check_failures,
        original_price_cents=item.original_price_cents,
        lowest_price_cents=item.lowest_price_cents,
        previous_price_cents=item.previous_price_cents,
        price_changed_at=item.price_changed_at,
    )


# =============================================================================
# Fetching
# =============================================================================


# Short, plain messages. The UI pairs them with a one-word status, so they
# never need to explain what happened twice.
FAILURE_MESSAGES = {
    PriceCheckFailureReason.BLOCKED: "The store blocked the check.",
    PriceCheckFailureReason.UNREACHABLE: "Couldn't reach the store.",
    PriceCheckFailureReason.NO_PRICE: "No price on the page - it may be sold out.",
    PriceCheckFailureReason.LINK_MOVED: "The link now opens a different page.",
    PriceCheckFailureReason.DIFFERENT_PRODUCT: "The page shows a different product.",
    PriceCheckFailureReason.IMPLAUSIBLE: "The price we found looks wrong.",
    PriceCheckFailureReason.NO_LINK: "No product link to check.",
}


def failure_message(reason: PriceCheckFailureReason) -> str:
    return FAILURE_MESSAGES[reason]


def _parse_error_reason(error: ParseError) -> PriceCheckFailureReason:
    detail = error.message
    if "challenge_page" in detail:
        return PriceCheckFailureReason.BLOCKED
    if "extraction_failed" in detail:
        return PriceCheckFailureReason.NO_PRICE
    return PriceCheckFailureReason.UNREACHABLE


async def fetch_price_observation(url: str) -> PriceObservation:
    """Fetch a product page and read its price.

    This is the only place that touches the network, so recording and
    identity logic can be tested without it.

    Raises:
        PriceCheckFailed: with a short message and a reason.
    """
    try:
        metadata, _method = await parse_url(url)
    except ParseError as e:
        reason = _parse_error_reason(e)
        raise PriceCheckFailed(
            failure_message(reason), reason, technical=e.message
        ) from e
    except Exception as e:  # network/library surprises must never crash the job
        logger.warning("Unexpected error checking price for %s: %s", url, e)
        raise PriceCheckFailed(
            failure_message(PriceCheckFailureReason.UNREACHABLE),
            PriceCheckFailureReason.UNREACHABLE,
            technical=str(e),
        ) from e

    if metadata.price_cents is None:
        raise PriceCheckFailed(
            failure_message(PriceCheckFailureReason.NO_PRICE),
            PriceCheckFailureReason.NO_PRICE,
            technical="no price in metadata",
        )
    return PriceObservation(
        price_cents=metadata.price_cents,
        currency=metadata.currency,
        title=metadata.title,
        final_url=metadata.final_url,
    )


async def observe_item_price(item: WishlistItem) -> PriceObservation:
    """Read the item's current price, refusing prices from the wrong page.

    A link that has rotted often still answers with HTTP 200 - the store
    redirects it to a category listing or a replacement product, and the
    first price on that page is not this item's price. Anything we can't
    recognise as the tracked product is a failure, never a new price.

    Raises:
        PriceCheckFailed: with a short message and a reason.
    """
    if not item.product_url:
        raise PriceCheckFailed(
            failure_message(PriceCheckFailureReason.NO_LINK),
            PriceCheckFailureReason.NO_LINK,
        )

    observation = await fetch_price_observation(item.product_url)
    verdict = verify_identity(
        product_url=item.product_url,
        final_url=observation.final_url,
        page_title=observation.title,
        item_title=item.title,
        verified_title=item.price_verified_title,
    )
    if not verdict.ok and verdict.reason is not None:
        raise PriceCheckFailed(
            failure_message(verdict.reason), verdict.reason, technical=verdict.detail
        )
    return observation


# =============================================================================
# Recording (no network)
# =============================================================================


def _add_point(
    session: Session,
    item: WishlistItem,
    price_cents: int,
    currency: str | None,
    source: PricePointSource,
    now: datetime,
) -> None:
    session.add(
        PricePoint(
            item_id=item.id,
            recorded_at=now,
            price_cents=price_cents,
            currency=currency,
            source=source,
            verified=True,
        )
    )


class HistorySummary(NamedTuple):
    """The summary columns, derived rather than accumulated."""

    lowest_price_cents: int
    previous_price_cents: int | None
    price_changed_at: datetime | None


def summarize_history(
    *,
    added_at: datetime | None,
    original_price_cents: int | None,
    points: list[tuple[datetime, int]],
    current_price_cents: int,
) -> HistorySummary:
    """Read the summary off the price series instead of accumulating it.

    A running minimum can never recover from one bad reading - the wrong
    number stays the item's "lowest" for good. Deriving the summary means
    dropping a bad reading is all it takes to put the item right.
    """
    series: list[tuple[datetime | None, int]] = []
    if original_price_cents is not None:
        series.append((added_at, original_price_cents))
    series.extend(sorted(points, key=lambda p: p[0]))
    if not series or series[-1][1] != current_price_cents:
        series.append((None, current_price_cents))

    lowest = min(price for _, price in series)

    previous: int | None = None
    changed_at: datetime | None = None
    for index in range(len(series) - 1, 0, -1):
        if series[index][1] != series[index - 1][1]:
            previous = series[index - 1][1]
            changed_at = series[index][0]
            break

    return HistorySummary(lowest, previous, changed_at)


def seed_tracking(
    session: Session,
    item: WishlistItem,
    observation: PriceObservation,
    now: datetime | None = None,
) -> None:
    """Enable tracking for a freshly verified price (no commit).

    Used when an item is created from a parsed URL and when a user turns
    tracking on after a successful live check.
    """
    now = now or _utcnow()
    price_cents = observation.price_cents
    if observation.title:
        item.price_verified_title = observation.title[:255]
    item.price_tracking_enabled = True
    item.price_tracking_paused_at = None
    item.price_verified_at = now
    item.price_checked_at = now
    item.price_check_failures = 0
    item.price_check_error = None
    item.price_check_reason = None
    if item.original_price_cents is None:
        item.original_price_cents = price_cents
    item.lowest_price_cents = (
        price_cents
        if item.lowest_price_cents is None
        else min(item.lowest_price_cents, price_cents)
    )
    _add_point(
        session, item, price_cents, observation.currency, PricePointSource.INITIAL, now
    )
    session.add(item)


def reset_tracking(session: Session, item: WishlistItem) -> None:
    """Forget what we read from the old page (no commit).

    Called when the product URL changes: those readings came from a
    different page, and the new one has to prove it can be parsed again.
    The price the item was *added* at survives - that belongs to the item,
    not to whichever link was on it, and it keeps the graph's starting
    point honest after the owner fixes a link.
    """
    item.price_tracking_enabled = False
    item.price_tracking_paused_at = None
    item.price_verified_at = None
    item.price_checked_at = None
    item.price_check_failures = 0
    item.price_check_error = None
    item.price_check_reason = None
    item.price_verified_title = None
    item.lowest_price_cents = None
    item.previous_price_cents = None
    item.price_changed_at = None
    for point in session.exec(
        select(PricePoint).where(PricePoint.item_id == item.id)
    ).all():
        session.delete(point)
    session.add(item)


def apply_price_observation(
    session: Session,
    item: WishlistItem,
    observation: PriceObservation,
    source: PricePointSource,
    now: datetime | None = None,
    notify: bool = True,
) -> PriceCheckOutcome:
    """Record a price we trust (no commit).

    Updates the item's current price when it changed, keeps the summary
    columns in sync, appends a PricePoint and optionally notifies the owner.

    Raises:
        PriceCheckFailed: if the price fails the plausibility guardrail.
    """
    now = now or _utcnow()
    old_price = item.price_cents
    price_cents = observation.price_cents

    if not is_price_plausible(price_cents, old_price):
        raise PriceCheckFailed(
            f"{format_cents(price_cents)} is too far from {format_cents(old_price)} "
            "to trust.",
            PriceCheckFailureReason.IMPLAUSIBLE,
            technical=f"implausible price {price_cents} vs {old_price}",
        )

    item.price_verified_at = now
    item.price_checked_at = now
    item.price_check_failures = 0
    item.price_check_error = None
    item.price_check_reason = None
    if observation.title:
        # Baseline for the next check: what this page calls itself today.
        item.price_verified_title = observation.title[:255]
    # A successful check is proof the page is trackable - start tracking it
    # automatically, no button required, unless the owner turned it off.
    if not item.price_tracking_disabled_by_user:
        item.price_tracking_enabled = True
        item.price_tracking_paused_at = None
    if item.original_price_cents is None:
        item.original_price_cents = old_price
    _add_point(session, item, price_cents, observation.currency, source, now)

    outcome = PriceCheckOutcome.UNCHANGED
    if price_cents != old_price:
        outcome = (
            PriceCheckOutcome.DROPPED
            if price_cents < old_price
            else PriceCheckOutcome.INCREASED
        )
        item.price_cents = price_cents
        if notify:
            _notify_price_change(session, item, old_price, price_cents, outcome)

    # This reading is one we can vouch for, so anything recorded before we
    # could tell a product page from a category listing goes. Then the
    # summary is rebuilt from what survives.
    drop_unverified_points(session, item)
    refresh_summary(session, item)

    session.add(item)
    return outcome


def drop_unverified_points(session: Session, item: WishlistItem) -> int:
    """Forget readings taken before their page could be checked (no commit).

    Returns:
        How many readings were dropped.
    """
    stale = session.exec(
        select(PricePoint)
        .where(PricePoint.item_id == item.id)
        .where(col(PricePoint.verified).is_(False))
    ).all()
    for point in stale:
        session.delete(point)
    if stale:
        logger.info("Dropped %d unverified price points for %s", len(stale), item.id)
    return len(stale)


def refresh_summary(session: Session, item: WishlistItem) -> None:
    """Rebuild the summary columns from the readings on record (no commit)."""
    session.flush()
    summary = summarize_history(
        added_at=_aware(item.added_at),
        original_price_cents=item.original_price_cents,
        points=[
            (_aware(p.recorded_at) or _utcnow(), p.price_cents)
            for p in get_price_points(session, item.id)
        ],
        current_price_cents=item.price_cents,
    )
    item.lowest_price_cents = summary.lowest_price_cents
    item.previous_price_cents = summary.previous_price_cents
    item.price_changed_at = summary.price_changed_at
    session.add(item)


def record_check_failure(
    session: Session,
    item: WishlistItem,
    message: str,
    reason: PriceCheckFailureReason = PriceCheckFailureReason.UNREACHABLE,
    now: datetime | None = None,
    notify: bool = True,
) -> bool:
    """Record a failed check (no commit). The item's price is left alone.

    Returns:
        True if tracking was paused because of repeated failures.
    """
    now = now or _utcnow()
    item.price_checked_at = now
    item.price_check_failures += 1
    item.price_check_error = message[:500]
    item.price_check_reason = reason.value
    paused = False

    if item.price_check_failures >= MAX_CONSECUTIVE_FAILURES:
        was_eligible = is_eligible(item)
        item.price_tracking_enabled = False
        item.price_tracking_paused_at = now
        paused = True
        if notify:
            if reason in NEEDS_NEW_LINK:
                title = "Check this link"
                body = f"{item.title}: the link no longer opens that product."
            elif was_eligible:
                title = "Price tracking paused"
                body = f"We couldn't check {item.title} for a few days."
            else:
                title = "Price tracking unavailable"
                body = f"We couldn't find a price for {item.title}."
            create_notification(
                session=session,
                user_id=item.owner_id,
                notification_type=NotificationType.PRICE_TRACKING_PAUSED,
                title=title,
                message=body,
                payload={
                    "item_id": str(item.id),
                    "reason": reason.value,
                    "detail": message,
                },
                send_push=True,
                image_url=item.image_url,
            )

    session.add(item)
    return paused


def _notify_price_change(
    session: Session,
    item: WishlistItem,
    old_price: int,
    new_price: int,
    outcome: PriceCheckOutcome,
) -> None:
    dropped = outcome == PriceCheckOutcome.DROPPED
    diff = abs(new_price - old_price)
    pct = round(diff / old_price * 100) if old_price else 0
    direction = "dropped" if dropped else "went up"
    create_notification(
        session=session,
        user_id=item.owner_id,
        notification_type=(
            NotificationType.PRICE_DROP if dropped else NotificationType.PRICE_INCREASE
        ),
        title="Price drop" if dropped else "Price went up",
        message=(
            f"{item.title} {direction} to {format_cents(new_price)} "
            f"(was {format_cents(old_price)}, {'-' if dropped else '+'}{pct}%)"
        ),
        payload={
            "item_id": str(item.id),
            "old_price_cents": old_price,
            "new_price_cents": new_price,
        },
        send_push=True,
        image_url=item.image_url,
    )


# =============================================================================
# Queries
# =============================================================================


def get_price_points(session: Session, item_id: uuid.UUID) -> list[PricePoint]:
    statement = (
        select(PricePoint)
        .where(PricePoint.item_id == item_id)
        .order_by(col(PricePoint.recorded_at).asc())
    )
    return list(session.exec(statement).all())


def get_price_history(session: Session, item: WishlistItem) -> PriceHistoryPublic:
    """Price history for the graph, starting at the price the item was added at.

    Readings only exist from the first check onwards, which for items that
    predate tracking is long after they were wishlisted. The graph should
    still start where the item's story starts, so the price it was added at
    is prepended as a point at its add date.
    """
    points = [
        PricePointPublic(
            recorded_at=p.recorded_at, price_cents=p.price_cents, source=p.source
        )
        for p in get_price_points(session, item.id)
    ]

    added_at = _aware(item.added_at)
    first_reading = _aware(points[0].recorded_at) if points else None
    original = item.original_price_cents
    if (
        original is not None
        and added_at is not None
        and (first_reading is None or first_reading - added_at > ADDED_POINT_MIN_GAP)
    ):
        points.insert(
            0,
            PricePointPublic(
                recorded_at=added_at,
                price_cents=original,
                source=PricePointSource.ADDED,
            ),
        )

    return PriceHistoryPublic(
        item_id=item.id,
        current_price_cents=item.price_cents,
        tracking=tracking_to_public(item),
        points=points,
    )


def get_items_due_for_check(
    session: Session, now: datetime | None = None, limit: int = 50
) -> list[WishlistItem]:
    """Items that should be checked and haven't been for ~a day.

    Tracking is automatic: any wishlisted item with a product link is a
    candidate, whether or not we've ever managed to read a price from it -
    the check itself is what establishes eligibility. Items the owner
    explicitly turned off, or that were auto-paused after repeated
    failures, are excluded until the owner retries them.
    """
    now = now or _utcnow()
    cutoff = now - timedelta(hours=CHECK_INTERVAL_HOURS)
    statement = (
        select(WishlistItem)
        .where(WishlistItem.status == WishlistItemStatus.WISHLISTED)
        .where(col(WishlistItem.product_url).isnot(None))
        .where(WishlistItem.price_tracking_disabled_by_user.is_(False))  # type: ignore[union-attr]
        .where(col(WishlistItem.price_tracking_paused_at).is_(None))
        .where(
            (col(WishlistItem.price_checked_at).is_(None))
            | (col(WishlistItem.price_checked_at) < cutoff)
        )
        .order_by(col(WishlistItem.price_checked_at).asc().nulls_first())
        .limit(limit)
    )
    return list(session.exec(statement).all())


# =============================================================================
# Commands
# =============================================================================


def _ensure_trackable(item: WishlistItem) -> None:
    if not item.product_url:
        raise ValidationError("Add a product link first.")
    if item.status != WishlistItemStatus.WISHLISTED:
        raise ValidationError("Only wishlisted items are tracked.")


async def enable_tracking(session: Session, item: WishlistItem) -> WishlistItem:
    """Turn tracking on, verifying live that we can read the page's price.

    Raises:
        ValidationError: with a user-friendly reason when it can't be enabled.
    """
    _ensure_trackable(item)
    assert item.product_url  # for type checkers; _ensure_trackable checked it

    try:
        observation = await observe_item_price(item)
    except PriceCheckFailed as e:
        logger.info("Could not enable price tracking for %s: %s", item.id, e.technical)
        item.price_check_reason = e.reason.value
        item.price_check_error = e.message[:500]
        session.add(item)
        session.commit()
        raise ValidationError(e.message)

    price_cents = observation.price_cents
    now = _utcnow()
    if item.price_verified_at is None or item.original_price_cents is None:
        # First time we see a price for this page - it becomes the baseline.
        if not is_price_plausible(price_cents, item.price_cents):
            raise ValidationError(
                f"{format_cents(price_cents)} is too far from this item's price "
                "to trust. Check the link points at the exact product."
            )
        if price_cents != item.price_cents:
            item.previous_price_cents = item.price_cents
            item.price_cents = price_cents
            item.price_changed_at = now
        seed_tracking(session, item, observation, now)
    else:
        # Re-enabling: treat like a normal check but stay quiet about changes.
        try:
            apply_price_observation(
                session,
                item,
                observation,
                PricePointSource.INITIAL,
                now,
                notify=False,
            )
        except PriceCheckFailed as e:
            raise ValidationError(e.message)
        item.price_tracking_enabled = True
        item.price_tracking_paused_at = None

    item.price_tracking_disabled_by_user = False
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def restart_tracking(session: Session, item: WishlistItem) -> WishlistItem:
    """Forget every reading and take the price back to what it was added at.

    The escape hatch for an item whose price went wrong before we could
    tell a product page from a category listing. Nothing here is a
    preference - tracking stays on and the next check starts a clean
    record - so it is deliberately separate from turning tracking off.
    """
    for point in session.exec(
        select(PricePoint).where(PricePoint.item_id == item.id)
    ).all():
        session.delete(point)

    if item.original_price_cents is not None:
        item.price_cents = item.original_price_cents
    item.lowest_price_cents = item.price_cents
    item.previous_price_cents = None
    item.price_changed_at = None
    item.price_check_failures = 0
    item.price_check_error = None
    item.price_check_reason = None
    item.price_verified_title = None
    item.price_tracking_paused_at = None
    if not item.price_tracking_disabled_by_user:
        item.price_tracking_enabled = True

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def disable_tracking(session: Session, item: WishlistItem) -> WishlistItem:
    """Turn tracking off. History is kept so it can be turned back on."""
    item.price_tracking_enabled = False
    item.price_tracking_paused_at = None
    item.price_tracking_disabled_by_user = True
    item.price_check_error = None
    item.price_check_reason = None
    item.price_check_failures = 0
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


async def check_item_price(
    session: Session,
    item: WishlistItem,
    source: PricePointSource = PricePointSource.SCHEDULED,
    notify: bool = True,
) -> PriceCheckResultPublic:
    """Run one price check for an item and persist the result.

    Never raises for fetch problems - failures are recorded on the item and
    reported in the returned result.
    """
    now = _utcnow()
    previous_price = item.price_cents

    try:
        observation = await observe_item_price(item)
        outcome = apply_price_observation(
            session, item, observation, source, now, notify=notify
        )
    except PriceCheckFailed as e:
        paused = record_check_failure(
            session, item, e.message, e.reason, now, notify=notify
        )
        session.commit()
        session.refresh(item)
        logger.info(
            "Price check failed for %s (%s): %s", item.id, e.reason.value, e.technical
        )
        message = e.message
        if paused:
            message += " Tracking is paused."
        return PriceCheckResultPublic(
            outcome=PriceCheckOutcome.FAILED,
            message=message,
            reason=e.reason,
            checked_at=now,
            previous_price_cents=previous_price,
            tracking=tracking_to_public(item),
        )

    session.commit()
    session.refresh(item)

    if outcome == PriceCheckOutcome.UNCHANGED:
        message = f"Still {format_cents(item.price_cents)}"
    elif outcome == PriceCheckOutcome.DROPPED:
        message = (
            f"Dropped to {format_cents(item.price_cents)} "
            f"from {format_cents(previous_price)}"
        )
    else:
        message = (
            f"Up to {format_cents(item.price_cents)} "
            f"from {format_cents(previous_price)}"
        )

    return PriceCheckResultPublic(
        outcome=outcome,
        message=message,
        checked_at=now,
        price_cents=item.price_cents,
        previous_price_cents=previous_price,
        tracking=tracking_to_public(item),
    )


def manual_check_wait_seconds(item: WishlistItem, now: datetime | None = None) -> int:
    """Seconds until the next manual check is allowed (0 = allowed now)."""
    now = now or _utcnow()
    last = _aware(item.price_checked_at)
    if last is None:
        return 0
    allowed_at = last + timedelta(minutes=MANUAL_CHECK_COOLDOWN_MINUTES)
    return max(0, int((allowed_at - now).total_seconds()))
