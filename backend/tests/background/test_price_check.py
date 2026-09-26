"""Tests for the background price check job."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlmodel import Session

from app.background import price_check
from app.features.price_tracking.models import PriceCheckOutcome
from app.features.wishlist_item.models import WishlistItemCreate
from app.features.wishlist_item.service import create_wishlist_item
from tests.utils.user import create_random_user


class TestCheckTrackedPrices:
    async def test_checks_due_items_only(self, session: Session) -> None:
        user = create_random_user(session)
        due = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Due",
                price_cents=5_000,
                product_url="https://example.com/due",
                price_from_url=True,
            ),
            user.id,
        )
        due.price_checked_at = datetime.now(timezone.utc) - timedelta(days=2)
        session.add(due)
        fresh = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Fresh",
                price_cents=5_000,
                product_url="https://example.com/fresh",
                price_from_url=True,
            ),
            user.id,
        )
        session.commit()

        checked: list[str] = []

        async def fake_check_one(item_id):  # noqa: ANN001, ANN202
            checked.append(str(item_id))
            return PriceCheckOutcome.UNCHANGED

        # The job opens its own sessions against the engine; point it at the
        # test session instead.
        class SessionFactory:
            def __init__(self, *_args, **_kwargs) -> None:
                pass

            def __enter__(self) -> Session:
                return session

            def __exit__(self, *_args) -> None:
                pass

        with (
            patch.object(price_check, "Session", SessionFactory),
            patch.object(price_check, "check_one_item", fake_check_one),
            patch.object(price_check.asyncio, "sleep", return_value=None),
        ):
            processed = await price_check.check_tracked_prices()

        assert processed == 1
        assert checked == [str(due.id)]
        assert str(fresh.id) not in checked

    async def test_disabled_feature_skips(self) -> None:
        with patch.object(price_check.settings, "PRICE_TRACKING_ENABLED", False):
            assert await price_check.check_tracked_prices() == 0

    async def test_different_domains_checked_concurrently(
        self, session: Session
    ) -> None:
        """Items on different stores should run as separate concurrent
        groups rather than one long serial queue."""
        user = create_random_user(session)
        for i in range(2):
            item = create_wishlist_item(
                session,
                WishlistItemCreate(
                    title=f"Store {i}",
                    price_cents=5_000,
                    product_url=f"https://store{i}.example.com/p",
                    price_from_url=True,
                ),
                user.id,
            )
            item.price_checked_at = datetime.now(timezone.utc) - timedelta(days=2)
            session.add(item)
        session.commit()

        in_flight = 0
        max_in_flight = 0

        async def fake_check_one(item_id):  # noqa: ANN001, ANN202
            nonlocal in_flight, max_in_flight
            in_flight += 1
            max_in_flight = max(max_in_flight, in_flight)
            await asyncio.sleep(0)  # yield control so both groups overlap
            in_flight -= 1
            return PriceCheckOutcome.UNCHANGED

        class SessionFactory:
            def __init__(self, *_args, **_kwargs) -> None:
                pass

            def __enter__(self) -> Session:
                return session

            def __exit__(self, *_args) -> None:
                pass

        with (
            patch.object(price_check, "Session", SessionFactory),
            patch.object(price_check, "check_one_item", fake_check_one),
        ):
            processed = await price_check.check_tracked_prices()

        assert processed == 2
        assert max_in_flight == 2  # both stores ran concurrently
