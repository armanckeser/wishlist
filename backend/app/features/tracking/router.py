"""Tracking routes for package tracking operations."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, OwnedWishlistItem, SessionDep
from app.core.config import settings
from app.features.tracking.models import (
    TrackingParseRequest,
    TrackingParseResponse,
    TrackingStatusPublic,
    TrackingSyncResponse,
)
from app.features.tracking.service import (
    get_items_with_tracking,
    parse_tracking_input,
    register_and_sync_tracking,
    sync_all_active_tracking,
    sync_item_tracking,
    tracking_info_to_public,
)
from app.features.wishlist_item.models import WishlistItemsPublic
from app.features.wishlist_item.service import wishlist_item_to_public

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.post("/parse", response_model=TrackingParseResponse)
def parse_tracking(
    request: TrackingParseRequest,
    _current_user: CurrentUser,
) -> TrackingParseResponse:
    """Parse a tracking number or URL to extract tracking information.

    Supports:
    - Raw tracking numbers (auto-detects carrier)
    - FedEx, UPS, USPS tracking URLs (extracts number and carrier)

    Does not register with 17track - use for validation/preview only.
    """
    if not settings.tracking_enabled:
        raise HTTPException(status_code=503, detail="Tracking is not enabled")

    return parse_tracking_input(request.input)


@router.get("", response_model=WishlistItemsPublic)
def list_tracked_items(
    session: SessionDep,
    current_user: CurrentUser,
) -> WishlistItemsPublic:
    """List all items with tracking information.

    Returns items that are:
    - TRACKING status (standalone tracked items)
    - PURCHASED or GIFTED with tracking_number set
    """
    items = get_items_with_tracking(session, current_user.id)
    public_items = [wishlist_item_to_public(item) for item in items]
    return WishlistItemsPublic(data=public_items, count=len(public_items))


@router.get("/{item_id}/status", response_model=TrackingStatusPublic)
def get_tracking_status(
    item: OwnedWishlistItem,
) -> TrackingStatusPublic:
    """Get detailed tracking status for an item.

    Returns parsed tracking events, estimated delivery, and current status.
    """
    result = tracking_info_to_public(item)
    if not result:
        raise HTTPException(
            status_code=404, detail="No tracking information for this item"
        )
    return result


@router.post("/{item_id}/sync", response_model=TrackingStatusPublic)
async def sync_tracking(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> TrackingStatusPublic:
    """Force refresh tracking status for an item from 17track.

    Use sparingly - tracking is automatically synced in the background.
    """
    if not settings.tracking_enabled:
        raise HTTPException(status_code=503, detail="Tracking is not enabled")

    if not item.tracking_number:
        raise HTTPException(status_code=400, detail="Item has no tracking number")

    # If never synced, register first
    if item.tracking_synced_at is None:
        updated_item = await register_and_sync_tracking(session, item)
    else:
        updated_item = await sync_item_tracking(session, item)

    result = tracking_info_to_public(updated_item)
    if not result:
        raise HTTPException(
            status_code=500, detail="Failed to retrieve tracking information"
        )
    return result


@router.post("/sync-all", response_model=TrackingSyncResponse)
async def sync_all_tracking(
    session: SessionDep,
    _current_user: CurrentUser,
) -> TrackingSyncResponse:
    """Sync tracking status for all active (non-delivered) items.

    This endpoint is intended for background job or manual triggering.
    Rate limited by 17track API (batches of 40 items).

    Requires admin privileges or can be restricted to superusers.
    """
    if not settings.tracking_enabled:
        raise HTTPException(status_code=503, detail="Tracking is not enabled")

    # For now, allow any authenticated user to trigger sync
    # In production, you may want to restrict this to superusers
    synced_count = await sync_all_active_tracking(session)

    return TrackingSyncResponse(
        synced_count=synced_count,
        message=f"Successfully synced {synced_count} items",
    )
