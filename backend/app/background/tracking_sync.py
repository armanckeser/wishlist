"""Background job for syncing tracking status and sending notifications.

Runs periodically to check all active (non-delivered) tracking items,
update their status from 17track, and send push notifications for
status changes.
"""

import logging
import uuid

from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.db import engine
from app.features.notification.models import NotificationType
from app.features.notification.service import create_notification
from app.features.tracking.models import DeliveryStatus, TrackInfo
from app.features.tracking.service import (
    get_active_tracking_items,
    sync_all_active_tracking,
)
from app.features.wishlist_item.models import WishlistItem

logger = logging.getLogger(__name__)


# Map DeliveryStatus to notification details
STATUS_NOTIFICATION_MAP: dict[DeliveryStatus, tuple[NotificationType, str, str]] = {
    DeliveryStatus.INFO_RECEIVED: (
        NotificationType.DELIVERY_INFO_RECEIVED,
        "Label Created",
        "{title} shipping label has been created",
    ),
    DeliveryStatus.IN_TRANSIT: (
        NotificationType.DELIVERY_IN_TRANSIT,
        "In Transit",
        "{title} is on its way!",
    ),
    DeliveryStatus.OUT_FOR_DELIVERY: (
        NotificationType.DELIVERY_OUT_FOR_DELIVERY,
        "Out for Delivery",
        "{title} is out for delivery!",
    ),
    DeliveryStatus.DELIVERED: (
        NotificationType.DELIVERY_DELIVERED,
        "Package Delivered",
        "{title} has been delivered!",
    ),
    DeliveryStatus.EXCEPTION: (
        NotificationType.DELIVERY_EXCEPTION,
        "Delivery Issue",
        "There's an issue with {title} delivery",
    ),
    DeliveryStatus.EXPIRED: (
        NotificationType.DELIVERY_EXPIRED,
        "Tracking Expired",
        "Tracking for {title} has expired",
    ),
}


def _get_item_status(item: WishlistItem) -> DeliveryStatus:
    """Extract current delivery status from item's tracking_data.

    Args:
        item: WishlistItem with tracking_data

    Returns:
        Current DeliveryStatus, defaults to NOT_FOUND
    """
    if not item.tracking_data:
        return DeliveryStatus.NOT_FOUND

    try:
        track_info = TrackInfo.model_validate(item.tracking_data)
        return track_info.normalized_status
    except Exception:
        return DeliveryStatus.NOT_FOUND


def _send_tracking_notification(
    session: Session,
    user_id: uuid.UUID,
    item: WishlistItem,
    new_status: DeliveryStatus,
) -> None:
    """Send a notification for a tracking status change.

    Args:
        session: Database session
        user_id: Owner's user ID
        item: WishlistItem that changed status
        new_status: New delivery status
    """
    if new_status not in STATUS_NOTIFICATION_MAP:
        return

    notification_type, title, message_template = STATUS_NOTIFICATION_MAP[new_status]
    message = message_template.format(title=item.title)

    create_notification(
        session=session,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        payload={"item_id": str(item.id), "tracking_number": item.tracking_number},
        send_push=True,
        image_url=item.image_url,
    )
    logger.info(
        "Sent %s notification for item %s (tracking: %s)",
        notification_type.value,
        item.id,
        item.tracking_number,
    )


async def sync_tracking_with_notifications() -> int:
    """Sync all active tracking items and send notifications for status changes.

    This is the main background job function. It:
    1. Gets all items with active (non-delivered) tracking
    2. Stores their current statuses
    3. Syncs tracking data from 17track API
    4. Detects status changes and sends notifications

    Returns:
        Number of items synced
    """
    import os

    if not settings.tracking_enabled:
        logger.warning("Tracking sync skipped: tracking not enabled")
        return 0

    worker_id = os.getpid()
    logger.info("Starting tracking sync job (worker PID: %d)...", worker_id)

    with Session(engine) as session:
        # Get items before sync to capture old statuses
        items = get_active_tracking_items(session)

        if not items:
            logger.info("No active tracking items to sync")
            return 0

        # Store old statuses keyed by item ID
        old_statuses: dict[uuid.UUID, DeliveryStatus] = {
            item.id: _get_item_status(item) for item in items
        }

        logger.info("Syncing %d active tracking items...", len(items))

        # Sync all items (this updates tracking_data in the database)
        synced_count = await sync_all_active_tracking(session)

        # Re-fetch items to get updated tracking_data
        session.expire_all()
        items = get_active_tracking_items(session)

        # Add back delivered items that were just synced (they're no longer "active")
        # We need to check items that had tracking but may now be delivered
        all_tracked_items = session.exec(
            select(WishlistItem).where(
                col(WishlistItem.id).in_(list(old_statuses.keys()))
            )
        ).all()

        # Check each item for status changes
        notifications_sent = 0
        for item in all_tracked_items:
            old_status = old_statuses.get(item.id, DeliveryStatus.NOT_FOUND)
            new_status = _get_item_status(item)

            # Only notify if status changed and new status is notifiable
            if old_status != new_status and new_status in STATUS_NOTIFICATION_MAP:
                _send_tracking_notification(session, item.owner_id, item, new_status)
                notifications_sent += 1

        logger.info(
            "Tracking sync complete (worker PID: %d): %d items synced, %d notifications sent",
            worker_id,
            synced_count,
            notifications_sent,
        )
        return synced_count
