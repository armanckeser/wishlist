"""Tracking service for package tracking operations.

Handles registration, syncing, and retrieval of tracking information
using the 17track API client.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Session, or_, select

from app.core.config import settings
from app.features.tracking.client import SeventeenTrackClient
from app.features.tracking.models import (
    DeliveryStatus,
    TrackingParseResponse,
    TrackingStatusPublic,
)
from app.features.wishlist_item.models import WishlistItem, WishlistItemStatus

if TYPE_CHECKING:
    from app.features.tracking.models import TrackInfo


def get_tracking_client() -> SeventeenTrackClient:
    """Get configured 17track client.

    Raises:
        RuntimeError: If tracking is not enabled (API key not configured).
    """
    if not settings.tracking_enabled or not settings.SEVENTEENTRACK_SECURITY_KEY:
        raise RuntimeError("Tracking is not enabled. Set SEVENTEENTRACK_SECURITY_KEY.")
    return SeventeenTrackClient(api_key=settings.SEVENTEENTRACK_SECURITY_KEY)


def parse_tracking_input(input_str: str) -> TrackingParseResponse:
    """Parse a tracking number or URL without hitting the API.

    Uses the tracking-numbers library for local carrier detection
    and URL parsing for FedEx/UPS/USPS URLs.

    Args:
        input_str: Tracking number or tracking URL

    Returns:
        Parsed tracking information with validation status
    """
    client = get_tracking_client()
    return client.parse_tracking_input(input_str)


def get_items_with_tracking(
    session: Session,
    owner_id: uuid.UUID,
) -> list[WishlistItem]:
    """Get all items with tracking information for a user.

    Returns items that are:
    - TRACKING status (standalone tracked items)
    - PURCHASED or GIFTED with a tracking_number set

    Args:
        session: Database session
        owner_id: User ID to filter by

    Returns:
        List of WishlistItems with tracking info
    """
    statement = select(WishlistItem).where(
        WishlistItem.owner_id == owner_id,
        or_(
            WishlistItem.status == WishlistItemStatus.TRACKING,
            (
                WishlistItem.tracking_number.isnot(None)
                & WishlistItem.status.in_(
                    [WishlistItemStatus.PURCHASED, WishlistItemStatus.GIFTED]
                )
            ),
        ),
    )
    return list(session.exec(statement).all())


def get_active_tracking_items(session: Session) -> list[WishlistItem]:
    """Get all items with active (non-delivered) tracking.

    Used for background sync job to refresh tracking status.

    Args:
        session: Database session

    Returns:
        List of WishlistItems that need tracking updates
    """
    statement = select(WishlistItem).where(
        WishlistItem.tracking_number.isnot(None),
        or_(
            WishlistItem.status == WishlistItemStatus.TRACKING,
            WishlistItem.status == WishlistItemStatus.PURCHASED,
            WishlistItem.status == WishlistItemStatus.GIFTED,
        ),
    )
    items = list(session.exec(statement).all())

    # Filter out delivered items by checking tracking_data
    active_items = []
    for item in items:
        if item.tracking_data:
            status = item.tracking_data.get("latest_status", {}).get("status", "")
            if status.lower() == "delivered":
                continue
        active_items.append(item)

    return active_items


async def register_and_sync_tracking(
    session: Session,
    item: WishlistItem,
) -> WishlistItem:
    """Register tracking number with 17track and fetch initial status.

    Args:
        session: Database session
        item: WishlistItem with tracking_number set

    Returns:
        Updated WishlistItem with tracking_data populated

    Raises:
        ValueError: If item has no tracking_number
    """
    if not item.tracking_number:
        raise ValueError("Item has no tracking_number")

    client = get_tracking_client()

    # Register and fetch tracking info
    track_info = await client.track_package(item.tracking_number)

    if track_info:
        _update_item_from_track_info(item, track_info)

    item.tracking_synced_at = datetime.now(timezone.utc)
    session.add(item)
    session.commit()
    session.refresh(item)

    return item


async def sync_item_tracking(
    session: Session,
    item: WishlistItem,
) -> WishlistItem:
    """Refresh tracking status for an item from 17track.

    Args:
        session: Database session
        item: WishlistItem with tracking_number set

    Returns:
        Updated WishlistItem with fresh tracking_data
    """
    if not item.tracking_number:
        raise ValueError("Item has no tracking_number")

    client = get_tracking_client()

    # Fetch current tracking info (already registered)
    response = await client.get_tracking_info([item.tracking_number])

    if response.is_success:
        results = response.get_accepted()
        if results and results[0].track_info:
            _update_item_from_track_info(item, results[0].track_info)

    item.tracking_synced_at = datetime.now(timezone.utc)
    session.add(item)
    session.commit()
    session.refresh(item)

    return item


async def sync_all_active_tracking(session: Session) -> int:
    """Sync tracking status for all active (non-delivered) items.

    Batches requests to 17track API (max 40 per request).

    Args:
        session: Database session

    Returns:
        Number of items synced
    """
    items = get_active_tracking_items(session)

    if not items:
        return 0

    client = get_tracking_client()
    synced_count = 0

    # Process in batches of 40 (17track limit)
    batch_size = 40
    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]
        tracking_numbers = [
            item.tracking_number for item in batch if item.tracking_number
        ]

        if not tracking_numbers:
            continue

        response = await client.get_tracking_info(tracking_numbers)

        if response.is_success:
            # Build a map of tracking_number -> track_info
            info_map: dict[str, TrackInfo] = {}
            for result in response.get_accepted():
                if result.track_info:
                    info_map[result.number] = result.track_info

            # Update each item
            for item in batch:
                if item.tracking_number and item.tracking_number in info_map:
                    _update_item_from_track_info(item, info_map[item.tracking_number])
                    item.tracking_synced_at = datetime.now(timezone.utc)
                    session.add(item)
                    synced_count += 1

    session.commit()
    return synced_count


def _update_item_from_track_info(item: WishlistItem, track_info: TrackInfo) -> None:
    """Update WishlistItem fields from TrackInfo.

    Args:
        item: WishlistItem to update
        track_info: TrackInfo from 17track API
    """
    # Store raw tracking data as JSON
    item.tracking_data = track_info.model_dump(mode="json")

    # Update carrier if detected
    if track_info.carrier_name:
        item.tracking_carrier = track_info.carrier_name

    # Update estimated delivery
    item.estimated_delivery_at = track_info.estimated_delivery


def tracking_info_to_public(
    item: WishlistItem,
) -> TrackingStatusPublic | None:
    """Convert stored tracking data to public response.

    Args:
        item: WishlistItem with tracking data

    Returns:
        TrackingStatusPublic or None if no tracking data
    """
    if not item.tracking_number:
        return None

    # Parse stored tracking_data if available
    events = []
    latest_description = None
    latest_location = None
    latest_timestamp = None
    status = DeliveryStatus.NOT_FOUND
    status_label = "Not Found"

    if item.tracking_data:
        from app.features.tracking.models import TrackInfo

        try:
            track_info = TrackInfo.model_validate(item.tracking_data)
            status = track_info.normalized_status
            status_label = status.value.replace("_", " ").title()
            events = track_info.events

            if track_info.latest_event:
                latest_description = track_info.latest_event.description
                latest_location = track_info.latest_event.location
                latest_timestamp = track_info.latest_event.timestamp
        except Exception:
            pass

    return TrackingStatusPublic(
        tracking_number=item.tracking_number,
        carrier=item.tracking_carrier,
        status=status,
        status_label=status_label,
        estimated_delivery_at=item.estimated_delivery_at,
        latest_event_description=latest_description,
        latest_event_location=latest_location,
        latest_event_at=latest_timestamp,
        events=events,
        synced_at=item.tracking_synced_at,
    )
