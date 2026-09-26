"""Tests for the price tracking service (no network)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlmodel import Session, select

from app.core.exceptions import ValidationError
from app.features.notification.models import Notification, NotificationType
from app.features.price_tracking.models import (
    MAX_CONSECUTIVE_FAILURES,
    PriceCheckFailureReason,
    PriceCheckOutcome,
    PricePoint,
    PricePointSource,
)
from app.features.price_tracking.service import (
    PriceCheckFailed,
    PriceObservation,
    apply_price_observation,
    check_item_price,
    disable_tracking,
    enable_tracking,
    format_cents,
    get_items_due_for_check,
    get_price_history,
    get_price_points,
    is_price_plausible,
    manual_check_wait_seconds,
    record_check_failure,
    reset_tracking,
    restart_tracking,
    summarize_history,
)
from app.features.users.models import User
from app.features.wishlist_item.models import (
    WishlistedItemPublic,
    WishlistItem,
    WishlistItemCreate,
    WishlistItemStatus,
    WishlistItemUpdate,
)
from app.features.wishlist_item.service import (
    create_wishlist_item,
    update_wishlist_item,
    wishlist_item_to_public,
)
from tests.utils.user import create_random_user

URL = "https://example.com/products/troy-and-abed-mug"
PAGE_TITLE = "Troy and Abed mug"


def make_item(
    session: Session,
    user: User,
    *,
    price_cents: int = 10_000,
    price_from_url: bool = True,
    product_url: str | None = URL,
) -> WishlistItem:
    return create_wishlist_item(
        session,
        WishlistItemCreate(
            title="Troy and Abed mug",
            price_cents=price_cents,
            product_url=product_url,
            price_from_url=price_from_url,
        ),
        user.id,
    )


def notifications_for(session: Session, user: User) -> list[Notification]:
    return list(
        session.exec(select(Notification).where(Notification.user_id == user.id)).all()
    )


class TestHelpers:
    def test_format_cents(self) -> None:
        assert format_cents(12000) == "$120"
        assert format_cents(11999) == "$119.99"
        assert format_cents(123456700) == "$1,234,567"

    def test_plausibility_guardrail(self) -> None:
        assert is_price_plausible(9000, 10000)
        assert is_price_plausible(45000, 10000)
        assert not is_price_plausible(0, 10000)
        assert not is_price_plausible(1000, 10000)  # 90% drop - suspicious
        assert not is_price_plausible(60000, 10000)  # 6x jump
        assert is_price_plausible(5000, 0)  # no reference: accept anything > 0


class TestCreateGuardrail:
    def test_price_from_url_enables_tracking_and_seeds_history(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        assert item.price_tracking_enabled is True
        assert item.price_verified_at is not None
        assert item.original_price_cents == 10_000
        assert item.lowest_price_cents == 10_000

        history = get_price_history(session, item)
        assert len(history.points) == 1
        assert history.points[0].source == PricePointSource.INITIAL
        assert history.tracking.eligible is True

    def test_manual_price_does_not_enable_tracking(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user, price_from_url=False)

        assert item.price_tracking_enabled is False
        assert item.price_verified_at is None
        assert get_price_history(session, item).points == []

        public = wishlist_item_to_public(item)
        assert isinstance(public, WishlistedItemPublic)
        assert public.price_tracking is not None
        assert public.price_tracking.eligible is False

    def test_no_url_never_enables_tracking(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user, product_url=None, price_from_url=True)

        assert item.price_tracking_enabled is False

    def test_changing_url_resets_tracking(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        updated = update_wishlist_item(
            session,
            item.id,
            WishlistItemUpdate(product_url="https://example.com/other"),
            user.id,
        )

        assert updated.price_tracking_enabled is False
        assert updated.price_verified_at is None
        assert [p.price_cents for p in get_price_points(session, updated.id)] == []
        # What it was added at belongs to the item, not to the old link, so
        # the graph still starts where the item started.
        assert updated.original_price_cents == 10_000

    def test_updating_title_keeps_tracking(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        updated = update_wishlist_item(
            session, item.id, WishlistItemUpdate(title="Renamed"), user.id
        )

        assert updated.price_tracking_enabled is True
        assert len(get_price_history(session, updated).points) == 1


class TestApplyObservation:
    def test_unchanged_price_adds_point_without_notification(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        outcome = apply_price_observation(
            session, item, PriceObservation(10_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert outcome == PriceCheckOutcome.UNCHANGED
        assert item.price_cents == 10_000
        assert item.previous_price_cents is None
        assert len(get_price_history(session, item).points) == 2
        assert notifications_for(session, user) == []

    def test_price_drop_updates_item_and_notifies(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        outcome = apply_price_observation(
            session, item, PriceObservation(8_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert outcome == PriceCheckOutcome.DROPPED
        assert item.price_cents == 8_000
        assert item.previous_price_cents == 10_000
        assert item.lowest_price_cents == 8_000
        assert item.original_price_cents == 10_000
        assert item.price_changed_at is not None

        notes = notifications_for(session, user)
        assert len(notes) == 1
        assert notes[0].notification_type == NotificationType.PRICE_DROP
        assert "$80" in notes[0].message
        assert "$100" in notes[0].message
        assert notes[0].payload == {
            "item_id": str(item.id),
            "old_price_cents": 10_000,
            "new_price_cents": 8_000,
        }

    def test_price_increase_notifies(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        outcome = apply_price_observation(
            session, item, PriceObservation(12_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert outcome == PriceCheckOutcome.INCREASED
        assert item.price_cents == 12_000
        assert item.lowest_price_cents == 10_000
        notes = notifications_for(session, user)
        assert [n.notification_type for n in notes] == [NotificationType.PRICE_INCREASE]

    def test_implausible_price_is_rejected(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with pytest.raises(PriceCheckFailed) as exc_info:
            apply_price_observation(
                session, item, PriceObservation(100, "USD"), PricePointSource.SCHEDULED
            )

        assert exc_info.value.reason == PriceCheckFailureReason.IMPLAUSIBLE
        assert item.price_cents == 10_000

    def test_failures_clear_on_success(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        record_check_failure(session, item, "The store is blocking us.")
        session.commit()
        assert item.price_check_failures == 1
        assert item.price_check_error == "The store is blocking us."

        apply_price_observation(
            session, item, PriceObservation(10_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert item.price_check_failures == 0
        assert item.price_check_error is None


class TestFailures:
    def test_repeated_failures_pause_tracking_and_notify(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        paused = False
        for _ in range(MAX_CONSECUTIVE_FAILURES):
            paused = record_check_failure(session, item, "Couldn't reach the store.")
        session.commit()

        assert paused is True
        assert item.price_tracking_enabled is False
        assert item.price_tracking_paused_at is not None
        notes = notifications_for(session, user)
        assert [n.notification_type for n in notes] == [
            NotificationType.PRICE_TRACKING_PAUSED
        ]
        assert notes[0].title == "Price tracking paused"

        public = wishlist_item_to_public(item)
        assert isinstance(public, WishlistedItemPublic)
        assert public.price_tracking is not None
        assert public.price_tracking.paused is True
        assert public.price_tracking.eligible is True  # can be re-enabled

    def test_repeated_failures_on_never_eligible_item_pause_too(
        self, session: Session
    ) -> None:
        """An item that never managed to establish a price is still a
        scheduler candidate (tracking is automatic), so it must be paused
        after repeated failures just like an already-eligible item -
        otherwise a permanently unparsable page would be retried forever."""
        user = create_random_user(session)
        item = make_item(session, user, price_from_url=False)
        assert item.price_verified_at is None

        paused = False
        for _ in range(MAX_CONSECUTIVE_FAILURES):
            paused = record_check_failure(session, item, "No price found.")
        session.commit()

        assert paused is True
        assert item.price_tracking_paused_at is not None
        notes = notifications_for(session, user)
        assert [n.notification_type for n in notes] == [
            NotificationType.PRICE_TRACKING_PAUSED
        ]
        assert notes[0].title == "Price tracking unavailable"

    def test_fewer_failures_keep_tracking_on(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        for _ in range(MAX_CONSECUTIVE_FAILURES - 1):
            record_check_failure(session, item, "Couldn't reach the store.")
        session.commit()

        assert item.price_tracking_enabled is True
        assert notifications_for(session, user) == []

    def test_manual_check_cooldown(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        now = datetime.now(timezone.utc)

        item.price_checked_at = now
        assert manual_check_wait_seconds(item, now) > 0

        item.price_checked_at = now - timedelta(minutes=11)
        assert manual_check_wait_seconds(item, now) == 0

        item.price_checked_at = None
        assert manual_check_wait_seconds(item, now) == 0


class TestDueItems:
    def test_only_due_wishlisted_tracked_items(self, session: Session) -> None:
        user = create_random_user(session)
        now = datetime.now(timezone.utc)

        fresh = make_item(session, user)  # checked just now (seeded)
        due = make_item(session, user)
        due.price_checked_at = now - timedelta(days=1, hours=1)
        never = make_item(session, user)
        never.price_checked_at = None
        purchased = make_item(session, user)
        purchased.price_checked_at = now - timedelta(days=2)
        purchased.status = WishlistItemStatus.PURCHASED
        # Never had a price parsed yet, and never checked - tracking is
        # automatic, so this is still a candidate for a first check.
        not_yet_eligible = make_item(session, user, price_from_url=False)
        not_yet_eligible.price_checked_at = None
        # The owner explicitly turned tracking off - excluded until retried.
        disabled_by_user = make_item(session, user)
        disabled_by_user.price_checked_at = now - timedelta(days=2)
        disabled_by_user.price_tracking_disabled_by_user = True
        # Auto-paused after repeated failures - excluded until retried.
        paused = make_item(session, user)
        paused.price_checked_at = now - timedelta(days=2)
        paused.price_tracking_paused_at = now - timedelta(days=2)
        session.add_all(
            [due, never, purchased, not_yet_eligible, disabled_by_user, paused]
        )
        session.commit()

        due_ids = {item.id for item in get_items_due_for_check(session, now)}

        assert due_ids == {due.id, never.id, not_yet_eligible.id}
        assert fresh.id not in due_ids
        assert purchased.id not in due_ids
        assert disabled_by_user.id not in due_ids
        assert paused.id not in due_ids


class TestCheckItemPrice:
    async def test_successful_check_records_result(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(9_000, "USD", title=PAGE_TITLE),
        ):
            result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.DROPPED
        assert result.price_cents == 9_000
        assert result.previous_price_cents == 10_000
        assert "Dropped to $90" in result.message
        assert item.price_cents == 9_000

    async def test_first_successful_check_auto_enables_tracking(
        self, session: Session
    ) -> None:
        """A scheduled first check on an item that was never explicitly
        enabled (e.g. manual price entry) starts tracking automatically once
        it proves the page can be read - no button click required."""
        user = create_random_user(session)
        item = make_item(session, user, price_from_url=False)
        assert item.price_tracking_enabled is False
        assert item.price_verified_at is None

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(9_000, "USD", title=PAGE_TITLE),
        ):
            await check_item_price(session, item, source=PricePointSource.SCHEDULED)

        assert item.price_tracking_enabled is True
        assert item.price_verified_at is not None

    async def test_first_check_does_not_reenable_after_user_disabled(
        self, session: Session
    ) -> None:
        """If the owner turned tracking off, a successful check must not
        silently turn it back on."""
        user = create_random_user(session)
        item = make_item(session, user)
        item.price_tracking_disabled_by_user = True
        item.price_tracking_enabled = False
        session.add(item)
        session.commit()

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(9_000, "USD", title=PAGE_TITLE),
        ):
            await check_item_price(session, item, source=PricePointSource.SCHEDULED)

        assert item.price_tracking_enabled is False

    async def test_failed_check_is_reported_not_raised(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            side_effect=PriceCheckFailed("The store is blocking automated checks."),
        ):
            result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.FAILED
        assert result.message == "The store is blocking automated checks."
        assert result.tracking.consecutive_failures == 1
        assert result.tracking.last_error == "The store is blocking automated checks."
        assert item.price_cents == 10_000


class TestEnableTracking:
    async def test_enable_requires_readable_price(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user, price_from_url=False)

        with (
            patch(
                "app.features.price_tracking.service.fetch_price_observation",
                side_effect=PriceCheckFailed("We couldn't reach the store."),
            ),
            pytest.raises(ValidationError) as exc_info,
        ):
            await enable_tracking(session, item)

        assert "We couldn't reach the store." in exc_info.value.detail
        assert item.price_tracking_enabled is False
        assert item.price_verified_at is None

    async def test_enable_seeds_history_with_live_price(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user, price_from_url=False)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(9_500, "USD", title=PAGE_TITLE),
        ):
            updated = await enable_tracking(session, item)

        assert updated.price_tracking_enabled is True
        assert updated.price_verified_at is not None
        assert updated.price_cents == 9_500
        assert updated.previous_price_cents == 10_000
        assert updated.original_price_cents == 9_500
        points = get_price_history(session, updated).points
        assert [p.price_cents for p in points] == [9_500]
        # Enabling is interactive - no notification spam
        assert notifications_for(session, user) == []

    async def test_enable_rejects_item_without_url(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user, product_url=None, price_from_url=False)

        with pytest.raises(ValidationError) as exc_info:
            await enable_tracking(session, item)

        assert "product link" in exc_info.value.detail

    async def test_reenable_after_pause_keeps_history(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        for _ in range(MAX_CONSECUTIVE_FAILURES):
            record_check_failure(session, item, "blocked", notify=False)
        session.commit()
        assert item.price_tracking_enabled is False

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(10_000, "USD", title=PAGE_TITLE),
        ):
            updated = await enable_tracking(session, item)

        assert updated.price_tracking_enabled is True
        assert updated.price_tracking_paused_at is None
        assert updated.price_check_failures == 0
        assert len(get_price_history(session, updated).points) == 2


class TestReset:
    def test_reset_deletes_points(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        reset_tracking(session, item)
        session.commit()

        assert (
            session.exec(select(PricePoint).where(PricePoint.item_id == item.id)).all()
            == []
        )


class TestWrongPageIsNeverAPrice:
    """A link that rots often still answers 200 - with someone else's price."""

    async def test_redirect_to_a_listing_does_not_touch_the_price(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(
                2_500,
                "USD",
                title="Mugs | Example",
                final_url="https://example.com/collections/mugs",
            ),
        ):
            result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.FAILED
        assert result.reason == PriceCheckFailureReason.LINK_MOVED
        assert item.price_cents == 10_000
        assert item.price_tracking_enabled is True
        # No reading was recorded for a page that isn't this product.
        assert [p.price_cents for p in get_price_history(session, item).points] == [
            10_000
        ]

    async def test_same_url_serving_another_product_is_rejected(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        item.price_verified_title = PAGE_TITLE
        session.add(item)
        session.commit()

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(
                4_000, "USD", title="Inspector Spacetime Scarf", final_url=URL
            ),
        ):
            result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.FAILED
        assert result.reason == PriceCheckFailureReason.DIFFERENT_PRODUCT
        assert item.price_cents == 10_000

    async def test_moved_product_with_the_same_name_still_updates(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(
                9_000,
                "USD",
                title="Troy and Abed mug",
                final_url="https://example.com/products/troy-and-abed-mug-v2",
            ),
        ):
            result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.DROPPED
        assert item.price_cents == 9_000

    async def test_failure_reason_is_stored_for_the_ui(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            side_effect=PriceCheckFailed(
                "The store blocked the check.", PriceCheckFailureReason.BLOCKED
            ),
        ):
            result = await check_item_price(session, item)

        assert result.tracking.last_error_reason == PriceCheckFailureReason.BLOCKED
        assert item.price_check_reason == "blocked"

    async def test_success_records_the_page_title_as_the_baseline(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        with patch(
            "app.features.price_tracking.service.fetch_price_observation",
            return_value=PriceObservation(
                9_000, "USD", title="Troy and Abed mug | Example", final_url=URL
            ),
        ):
            await check_item_price(session, item)

        assert item.price_verified_title == "Troy and Abed mug | Example"
        assert item.price_check_reason is None

    async def test_item_without_a_link_fails_without_touching_the_price(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user, product_url=None, price_from_url=False)

        result = await check_item_price(session, item)

        assert result.outcome == PriceCheckOutcome.FAILED
        assert result.reason == PriceCheckFailureReason.NO_LINK
        assert item.price_cents == 10_000


class TestHistoryStartsWhenTheItemWasAdded:
    def test_graph_starts_at_the_price_the_item_was_added_at(
        self, session: Session
    ) -> None:
        """Readings begin at the first check; the graph begins at day one."""
        user = create_random_user(session)
        item = make_item(session, user)
        item.added_at = datetime.now(timezone.utc) - timedelta(days=30)
        session.add(item)
        session.commit()

        apply_price_observation(
            session, item, PriceObservation(8_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        points = get_price_history(session, item).points
        assert points[0].source == PricePointSource.ADDED
        assert points[0].price_cents == 10_000
        assert [p.price_cents for p in points] == [10_000, 10_000, 8_000]

    def test_a_fresh_item_is_not_given_a_duplicate_first_point(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        points = get_price_history(session, item).points
        assert [p.source for p in points] == [PricePointSource.INITIAL]


class TestSummaryIsDerived:
    """A running minimum can never recover from one bad reading."""

    def test_lowest_and_previous_come_from_the_series(self) -> None:
        added = datetime(2026, 1, 1, tzinfo=timezone.utc)
        summary = summarize_history(
            added_at=added,
            original_price_cents=18_500,
            points=[
                (added + timedelta(days=1), 18_500),
                (added + timedelta(days=2), 16_800),
                (added + timedelta(days=3), 14_900),
            ],
            current_price_cents=14_900,
        )

        assert summary.lowest_price_cents == 14_900
        assert summary.previous_price_cents == 16_800
        assert summary.price_changed_at == added + timedelta(days=3)

    def test_a_flat_series_has_no_change(self) -> None:
        added = datetime(2026, 1, 1, tzinfo=timezone.utc)
        summary = summarize_history(
            added_at=added,
            original_price_cents=10_000,
            points=[(added + timedelta(days=1), 10_000)],
            current_price_cents=10_000,
        )

        assert summary.lowest_price_cents == 10_000
        assert summary.previous_price_cents is None
        assert summary.price_changed_at is None

    def test_dropping_a_bad_reading_restores_the_lowest(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        # A price grabbed off a category listing before identity was checked.
        session.add(
            PricePoint(
                item_id=item.id,
                price_cents=1_200,
                source=PricePointSource.SCHEDULED,
                verified=False,
            )
        )
        item.lowest_price_cents = 1_200
        session.add(item)
        session.commit()

        apply_price_observation(
            session, item, PriceObservation(10_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert item.lowest_price_cents == 10_000
        assert [p.price_cents for p in get_price_points(session, item.id)] == [
            10_000,
            10_000,
        ]


class TestHealingUnverifiedHistory:
    def test_first_verified_check_drops_readings_we_cannot_vouch_for(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        for price in (4_200, 4_200):
            session.add(
                PricePoint(
                    item_id=item.id,
                    price_cents=price,
                    source=PricePointSource.SCHEDULED,
                    verified=False,
                )
            )
        session.commit()

        apply_price_observation(
            session, item, PriceObservation(9_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        prices = [p.price_cents for p in get_price_points(session, item.id)]
        assert 4_200 not in prices
        assert prices[-1] == 9_000
        assert item.lowest_price_cents == 9_000
        assert item.previous_price_cents == 10_000

    def test_verified_readings_are_kept(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)

        apply_price_observation(
            session, item, PriceObservation(9_500, "USD"), PricePointSource.SCHEDULED
        )
        apply_price_observation(
            session, item, PriceObservation(9_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()

        assert [p.price_cents for p in get_price_points(session, item.id)] == [
            10_000,
            9_500,
            9_000,
        ]


class TestRestart:
    def test_restart_forgets_history_and_takes_the_added_price_back(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        apply_price_observation(
            session, item, PriceObservation(3_000, "USD"), PricePointSource.SCHEDULED
        )
        session.commit()
        assert item.price_cents == 3_000

        updated = restart_tracking(session, item)

        assert updated.price_cents == 10_000
        assert updated.original_price_cents == 10_000
        assert updated.lowest_price_cents == 10_000
        assert updated.previous_price_cents is None
        assert updated.price_changed_at is None
        assert get_price_points(session, updated.id) == []
        # Still watched - this is a repair, not a preference.
        assert updated.price_tracking_enabled is True

    def test_restart_clears_a_pause_and_its_reason(self, session: Session) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        for _ in range(MAX_CONSECUTIVE_FAILURES):
            record_check_failure(
                session,
                item,
                "The link now opens a different page.",
                PriceCheckFailureReason.LINK_MOVED,
                notify=False,
            )
        session.commit()
        assert item.price_tracking_paused_at is not None

        updated = restart_tracking(session, item)

        assert updated.price_tracking_paused_at is None
        assert updated.price_check_failures == 0
        assert updated.price_check_reason is None
        assert updated.price_tracking_enabled is True

    def test_restart_respects_an_owner_who_turned_tracking_off(
        self, session: Session
    ) -> None:
        user = create_random_user(session)
        item = make_item(session, user)
        disable_tracking(session, item)

        updated = restart_tracking(session, item)

        assert updated.price_tracking_enabled is False
