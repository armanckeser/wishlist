"""Price tracking routes."""

import logging

from fastapi import APIRouter, HTTPException

from app.api.deps import OwnedWishlistItem, SessionDep
from app.core.config import settings
from app.core.exceptions import ValidationError
from app.features.price_tracking.models import (
    PriceCheckResultPublic,
    PriceHistoryPublic,
    PricePointSource,
)
from app.features.price_tracking.service import (
    check_item_price,
    disable_tracking,
    enable_tracking,
    get_price_history,
    manual_check_wait_seconds,
    restart_tracking,
)
from app.features.wishlist_item.models import WishlistedItemPublic
from app.features.wishlist_item.service import wishlist_item_to_public

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/price-tracking", tags=["price-tracking"])


def _ensure_feature_enabled() -> None:
    if not settings.PRICE_TRACKING_ENABLED:
        raise HTTPException(
            status_code=503, detail="Price tracking is turned off on this server."
        )


@router.get("/{item_id}/history", response_model=PriceHistoryPublic)
def read_price_history(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> PriceHistoryPublic:
    """Price history and tracking state for an item (feeds the graph)."""
    return get_price_history(session, item)


@router.post("/{item_id}/enable", response_model=WishlistedItemPublic)
async def enable_price_tracking(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> WishlistedItemPublic:
    """Turn on price tracking.

    Performs a live check first: tracking is only enabled when we can actually
    read a price from the product page. Returns 400 with a plain-language
    reason otherwise.
    """
    _ensure_feature_enabled()
    updated = await enable_tracking(session, item)
    public = wishlist_item_to_public(updated)
    if not isinstance(public, WishlistedItemPublic):
        raise ValidationError("Only wishlisted items can be price tracked")
    return public


@router.post("/{item_id}/disable", response_model=WishlistedItemPublic)
def disable_price_tracking(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> WishlistedItemPublic:
    """Turn off price tracking. History is kept."""
    updated = disable_tracking(session, item)
    public = wishlist_item_to_public(updated)
    if not isinstance(public, WishlistedItemPublic):
        raise ValidationError("Only wishlisted items can be price tracked")
    return public


@router.post("/{item_id}/restart", response_model=WishlistedItemPublic)
def restart_price_tracking(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> WishlistedItemPublic:
    """Forget the readings and take the price back to what it was added at.

    For an item whose price was already wrong when identity checking
    arrived. Tracking stays on; the next check starts a clean record.
    """
    updated = restart_tracking(session, item)
    public = wishlist_item_to_public(updated)
    if not isinstance(public, WishlistedItemPublic):
        raise ValidationError("Only wishlisted items can be price tracked")
    return public


@router.post("/{item_id}/check", response_model=PriceCheckResultPublic)
async def check_price_now(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> PriceCheckResultPublic:
    """Check the price right now.

    Fetch problems are reported in the response body (outcome=failed) with a
    user-friendly message rather than as an HTTP error, so the UI can show
    them inline. Rate limited per item to avoid hammering stores.
    """
    _ensure_feature_enabled()
    if not item.price_tracking_enabled and item.price_verified_at is None:
        raise ValidationError("This item isn't being tracked yet.")
    if not item.product_url:
        raise ValidationError("Add a product link first.")

    wait = manual_check_wait_seconds(item)
    if wait > 0:
        minutes = max(1, -(-wait // 60))
        raise HTTPException(
            status_code=429,
            detail=f"Just checked. Try again in {minutes} min.",
        )

    return await check_item_price(
        session, item, source=PricePointSource.MANUAL, notify=False
    )
