"""TDD tests for tracking service and item creation.

Like Jeff Winger tracking his missing Netflix password,
we're tracking packages with rigorous testing.
"""

from sqlmodel import Session

from app.features.tracking.service import get_items_with_tracking
from app.features.wishlist_item.models import (
    WishlistItemCreate,
    WishlistItemStatus,
)
from app.features.wishlist_item.service import (
    create_wishlist_item,
    get_wishlist_items_for_user,
    mark_as_purchased,
    wishlist_item_to_public,
)
from tests.utils.user import create_random_user


class TestTrackingItemCreation:
    """Test that items with tracking_number get TRACKING status."""

    def test_create_item_with_tracking_number_sets_tracking_status(
        self, session: Session
    ) -> None:
        """Creating an item with tracking_number should set status to TRACKING."""
        user = create_random_user(session)

        item_create = WishlistItemCreate(
            title="Bambu Lab A1 3D Printer",
            price_cents=39900,
            tracking_number="888079995075",
            tracking_carrier="FedEx",
        )

        item = create_wishlist_item(session, item_create, user.id)

        assert item.status == WishlistItemStatus.TRACKING
        assert item.tracking_number == "888079995075"
        assert item.tracking_carrier == "FedEx"

    def test_create_item_without_tracking_number_sets_wishlisted_status(
        self, session: Session
    ) -> None:
        """Creating a regular item should have WISHLISTED status."""
        user = create_random_user(session)

        item_create = WishlistItemCreate(
            title="Cool Gadget",
            price_cents=2999,
        )

        item = create_wishlist_item(session, item_create, user.id)

        assert item.status == WishlistItemStatus.WISHLISTED
        assert item.tracking_number is None

    def test_create_item_with_empty_tracking_number_sets_wishlisted_status(
        self, session: Session
    ) -> None:
        """Empty tracking_number should not trigger TRACKING status."""
        user = create_random_user(session)

        item_create = WishlistItemCreate(
            title="Cool Gadget",
            price_cents=2999,
            tracking_number=None,
        )

        item = create_wishlist_item(session, item_create, user.id)

        assert item.status == WishlistItemStatus.WISHLISTED


class TestTrackingListQuery:
    """Test that GET /tracking returns correct items."""

    def test_get_items_with_tracking_returns_tracking_status_items(
        self, session: Session
    ) -> None:
        """Items with TRACKING status should appear in tracking list."""
        user = create_random_user(session)

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked Package",
                price_cents=1000,
                tracking_number="9214490358937913278325",
                tracking_carrier="USPS",
            ),
            user.id,
        )

        result = get_items_with_tracking(session, user.id)

        assert len(result) == 1
        assert result[0].id == tracked_item.id
        assert result[0].status == WishlistItemStatus.TRACKING

    def test_get_items_with_tracking_returns_purchased_items_with_tracking(
        self, session: Session
    ) -> None:
        """Purchased items with tracking_number should appear in tracking list."""
        user = create_random_user(session)

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Wishlisted then purchased",
                price_cents=5000,
            ),
            user.id,
        )

        purchased_item = mark_as_purchased(session, item)

        purchased_item.tracking_number = "888079995075"
        purchased_item.tracking_carrier = "FedEx"
        session.add(purchased_item)
        session.commit()
        session.refresh(purchased_item)

        result = get_items_with_tracking(session, user.id)

        assert len(result) == 1
        assert result[0].id == purchased_item.id
        assert result[0].status == WishlistItemStatus.PURCHASED

    def test_get_items_with_tracking_excludes_wishlisted_without_tracking(
        self, session: Session
    ) -> None:
        """Regular wishlisted items should NOT appear in tracking list."""
        user = create_random_user(session)

        regular_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Regular wishlist item",
                price_cents=2000,
            ),
            user.id,
        )

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked Package",
                price_cents=1000,
                tracking_number="1ZXJ33010323181135",
                tracking_carrier="UPS",
            ),
            user.id,
        )

        result = get_items_with_tracking(session, user.id)

        assert len(result) == 1
        assert result[0].id == tracked_item.id
        assert regular_item.id not in [item.id for item in result]

    def test_get_items_with_tracking_excludes_archived(self, session: Session) -> None:
        """Archived items should NOT appear in tracking list even with tracking_number."""
        user = create_random_user(session)

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked then archived",
                price_cents=1000,
                tracking_number="888079995075",
            ),
            user.id,
        )

        tracked_item.status = WishlistItemStatus.ARCHIVED
        session.add(tracked_item)
        session.commit()

        result = get_items_with_tracking(session, user.id)

        assert len(result) == 0

    def test_get_items_with_tracking_user_isolation(self, session: Session) -> None:
        """Users should only see their own tracked items - no Jeff Winger snooping."""
        user1 = create_random_user(session)
        user2 = create_random_user(session)

        user1_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="User 1 Package",
                price_cents=1000,
                tracking_number="888079995075",
            ),
            user1.id,
        )

        user2_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="User 2 Package",
                price_cents=2000,
                tracking_number="9214490358937913278325",
            ),
            user2.id,
        )

        result1 = get_items_with_tracking(session, user1.id)
        result2 = get_items_with_tracking(session, user2.id)

        assert len(result1) == 1
        assert result1[0].id == user1_item.id
        assert len(result2) == 1
        assert result2[0].id == user2_item.id


class TestTrackingItemToPublic:
    """Test that tracked items serialize correctly."""

    def test_tracking_item_to_public_returns_tracked_item_public(
        self, session: Session
    ) -> None:
        """Items with TRACKING status should serialize to TrackedItemPublic."""
        user = create_random_user(session)

        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked Package",
                price_cents=1000,
                tracking_number="888079995075",
                tracking_carrier="FedEx",
            ),
            user.id,
        )

        public = wishlist_item_to_public(item)

        assert public.status == "tracking"
        assert public.tracking_number == "888079995075"
        assert public.tracking_carrier == "FedEx"


class TestWishlistExcludesTracking:
    """Test that TRACKING items don't appear in wishlisted queries."""

    def test_get_wishlist_items_returns_all_statuses(self, session: Session) -> None:
        """get_wishlist_items_for_user returns items of all statuses.

        This is currently the behavior - filtering happens client-side.
        Documenting this to understand if this is the source of the bug.
        """
        user = create_random_user(session)

        regular_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Wishlisted item",
                price_cents=2000,
            ),
            user.id,
        )

        tracked_item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked Package",
                price_cents=1000,
                tracking_number="888079995075",
            ),
            user.id,
        )

        items, count = get_wishlist_items_for_user(session, user.id)

        item_ids = [item.id for item in items]
        assert regular_item.id in item_ids
        assert tracked_item.id in item_ids
        assert count == 2
