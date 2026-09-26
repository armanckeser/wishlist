"""Tests for the background tracking sync job.

Like Dean Pelton's obsessive tracking of Jeff's schedule,
we test that status changes trigger the right notifications.
"""

from unittest.mock import patch

import pytest
from sqlmodel import Session

from app.background.tracking_sync import (
    STATUS_NOTIFICATION_MAP,
    _get_item_status,
    _send_tracking_notification,
)
from app.features.notification.models import NotificationType
from app.features.tracking.models import DeliveryStatus
from app.features.wishlist_item.models import (
    WishlistItemCreate,
)
from app.features.wishlist_item.service import create_wishlist_item
from tests.utils.user import create_random_user


class TestGetItemStatus:
    """Test _get_item_status extracts status from tracking_data."""

    def test_returns_not_found_when_no_tracking_data(self, session: Session) -> None:
        """Items without tracking_data should return NOT_FOUND."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Package with no data",
                price_cents=1000,
                tracking_number="123456789",
            ),
            user.id,
        )

        status = _get_item_status(item)

        assert status == DeliveryStatus.NOT_FOUND

    def test_returns_delivered_status_from_tracking_data(
        self, session: Session
    ) -> None:
        """Items with DELIVERED tracking_data should return DELIVERED."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Delivered Package",
                price_cents=1000,
                tracking_number="123456789",
            ),
            user.id,
        )

        item.tracking_data = {
            "latest_status": {"status": "Delivered", "sub_status": None},
            "latest_event": {"description": "Delivered", "location": "Front door"},
        }
        session.add(item)
        session.commit()

        status = _get_item_status(item)

        assert status == DeliveryStatus.DELIVERED

    def test_returns_in_transit_status_from_tracking_data(
        self, session: Session
    ) -> None:
        """Items with InTransit tracking_data should return IN_TRANSIT."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="In Transit Package",
                price_cents=1000,
                tracking_number="123456789",
            ),
            user.id,
        )

        item.tracking_data = {
            "latest_status": {"status": "InTransit", "sub_status": None},
            "latest_event": {"description": "In transit", "location": "Memphis, TN"},
        }
        session.add(item)
        session.commit()

        status = _get_item_status(item)

        assert status == DeliveryStatus.IN_TRANSIT

    def test_returns_out_for_delivery_from_substatus(self, session: Session) -> None:
        """Items with OutForDelivery sub_status should return OUT_FOR_DELIVERY."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Out for Delivery Package",
                price_cents=1000,
                tracking_number="123456789",
            ),
            user.id,
        )

        item.tracking_data = {
            "latest_status": {"status": "InTransit", "sub_status": "OutForDelivery"},
            "latest_event": {"description": "Out for delivery"},
        }
        session.add(item)
        session.commit()

        status = _get_item_status(item)

        assert status == DeliveryStatus.OUT_FOR_DELIVERY


class TestStatusNotificationMap:
    """Test that all delivery statuses (except NOT_FOUND) have notification mappings."""

    def test_all_notifiable_statuses_have_mappings(self) -> None:
        """All statuses except NOT_FOUND should have notification mappings."""
        notifiable_statuses = [
            DeliveryStatus.INFO_RECEIVED,
            DeliveryStatus.IN_TRANSIT,
            DeliveryStatus.OUT_FOR_DELIVERY,
            DeliveryStatus.DELIVERED,
            DeliveryStatus.EXCEPTION,
            DeliveryStatus.EXPIRED,
        ]

        for status in notifiable_statuses:
            assert status in STATUS_NOTIFICATION_MAP, f"Missing mapping for {status}"

    def test_not_found_has_no_mapping(self) -> None:
        """NOT_FOUND should NOT trigger notifications."""
        assert DeliveryStatus.NOT_FOUND not in STATUS_NOTIFICATION_MAP


class TestSendTrackingNotification:
    """Test _send_tracking_notification creates correct notifications."""

    def test_sends_delivered_notification(self, session: Session) -> None:
        """DELIVERED status should create DELIVERY_DELIVERED notification."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Cool Gadget",
                price_cents=5000,
                tracking_number="123456789",
            ),
            user.id,
        )

        with patch("app.background.tracking_sync.create_notification") as mock_create:
            _send_tracking_notification(
                session, user.id, item, DeliveryStatus.DELIVERED
            )

            mock_create.assert_called_once()
            call_kwargs = mock_create.call_args.kwargs
            assert (
                call_kwargs["notification_type"] == NotificationType.DELIVERY_DELIVERED
            )
            assert call_kwargs["title"] == "Package Delivered"
            assert "Cool Gadget" in call_kwargs["message"]
            assert call_kwargs["send_push"] is True

    def test_sends_in_transit_notification(self, session: Session) -> None:
        """IN_TRANSIT status should create DELIVERY_IN_TRANSIT notification."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Awesome Item",
                price_cents=3000,
                tracking_number="987654321",
            ),
            user.id,
        )

        with patch("app.background.tracking_sync.create_notification") as mock_create:
            _send_tracking_notification(
                session, user.id, item, DeliveryStatus.IN_TRANSIT
            )

            mock_create.assert_called_once()
            call_kwargs = mock_create.call_args.kwargs
            assert (
                call_kwargs["notification_type"] == NotificationType.DELIVERY_IN_TRANSIT
            )
            assert call_kwargs["title"] == "In Transit"
            assert "Awesome Item is on its way!" in call_kwargs["message"]

    def test_sends_exception_notification(self, session: Session) -> None:
        """EXCEPTION status should create DELIVERY_EXCEPTION notification."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Problem Package",
                price_cents=2000,
                tracking_number="111222333",
            ),
            user.id,
        )

        with patch("app.background.tracking_sync.create_notification") as mock_create:
            _send_tracking_notification(
                session, user.id, item, DeliveryStatus.EXCEPTION
            )

            mock_create.assert_called_once()
            call_kwargs = mock_create.call_args.kwargs
            assert (
                call_kwargs["notification_type"] == NotificationType.DELIVERY_EXCEPTION
            )
            assert call_kwargs["title"] == "Delivery Issue"
            assert "Problem Package" in call_kwargs["message"]

    def test_does_not_send_for_not_found_status(self, session: Session) -> None:
        """NOT_FOUND status should NOT create any notification."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Unknown Package",
                price_cents=1000,
                tracking_number="000000000",
            ),
            user.id,
        )

        with patch("app.background.tracking_sync.create_notification") as mock_create:
            _send_tracking_notification(
                session, user.id, item, DeliveryStatus.NOT_FOUND
            )

            mock_create.assert_not_called()

    def test_notification_payload_includes_item_id_and_tracking(
        self, session: Session
    ) -> None:
        """Notification payload should include item_id and tracking_number."""
        user = create_random_user(session)
        item = create_wishlist_item(
            session,
            WishlistItemCreate(
                title="Tracked Item",
                price_cents=1000,
                tracking_number="TRACK123",
            ),
            user.id,
        )

        with patch("app.background.tracking_sync.create_notification") as mock_create:
            _send_tracking_notification(
                session, user.id, item, DeliveryStatus.DELIVERED
            )

            call_kwargs = mock_create.call_args.kwargs
            assert call_kwargs["payload"]["item_id"] == str(item.id)
            assert call_kwargs["payload"]["tracking_number"] == "TRACK123"


class TestAllNotificationTypes:
    """Test all delivery status → notification type mappings."""

    @pytest.mark.parametrize(
        "status,expected_type,expected_title",
        [
            (
                DeliveryStatus.INFO_RECEIVED,
                NotificationType.DELIVERY_INFO_RECEIVED,
                "Label Created",
            ),
            (
                DeliveryStatus.IN_TRANSIT,
                NotificationType.DELIVERY_IN_TRANSIT,
                "In Transit",
            ),
            (
                DeliveryStatus.OUT_FOR_DELIVERY,
                NotificationType.DELIVERY_OUT_FOR_DELIVERY,
                "Out for Delivery",
            ),
            (
                DeliveryStatus.DELIVERED,
                NotificationType.DELIVERY_DELIVERED,
                "Package Delivered",
            ),
            (
                DeliveryStatus.EXCEPTION,
                NotificationType.DELIVERY_EXCEPTION,
                "Delivery Issue",
            ),
            (
                DeliveryStatus.EXPIRED,
                NotificationType.DELIVERY_EXPIRED,
                "Tracking Expired",
            ),
        ],
    )
    def test_status_maps_to_correct_notification(
        self,
        status: DeliveryStatus,
        expected_type: NotificationType,
        expected_title: str,
    ) -> None:
        """Each delivery status should map to correct notification type and title."""
        notification_type, title, _ = STATUS_NOTIFICATION_MAP[status]

        assert notification_type == expected_type
        assert title == expected_title
