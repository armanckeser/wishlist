"""WishlistItem routes for managing wishlist."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from sqlmodel import SQLModel

from app.api.deps import (
    CurrentUser,
    CurrentUserBudget,
    OwnedWishlistItem,
    SessionDep,
)
from app.core.config import settings
from app.core.exceptions import PermissionDeniedError, ValidationError
from app.features.budget.models import CooloffSettingsPublic
from app.features.budget.service import (
    add_to_budget,
    apply_freeze,
    deduct_from_budget,
    get_or_create_budget,
    is_purchase_impulsive,
)
from app.features.category.models import CategoriesPublic
from app.features.category.service import category_to_public
from app.features.wishlist_item.models import (
    ArchivedItemPublic,
    BulkArchiveRequest,
    BulkDeleteRequest,
    BulkSetCategoriesRequest,
    GiftedItemPublic,
    GiftRequest,
    PurchasedItemPublic,
    PurchaseRequest,
    TrackedItemPublic,
    UndoRequest,
    WaiveCooldownRequest,
    WishlistedItemPublic,
    WishlistItemCreate,
    WishlistItemPublic,
    WishlistItemsPublic,
    WishlistItemStatus,
    WishlistItemUpdate,
    WishlistWithSettingsPublic,
)
from app.features.wishlist_item.service import (
    add_categories_to_item,
    bulk_archive_items,
    bulk_delete_items,
    bulk_set_categories,
    bulk_unarchive_items,
    create_wishlist_item,
    delete_wishlist_item,
    get_owned_wishlist_item,
    get_wishlist_item,
    get_wishlist_items_for_user,
    mark_as_gifted,
    mark_as_purchased,
    remove_category_from_item,
    toggle_most_desired,
    undo_item,
    update_wishlist_item,
    waive_item_cooldown,
    wishlist_item_to_public,
)
from app.features.wishlist_share.service import can_view_wishlist
from app.shared.models import Message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("/", response_model=WishlistItemsPublic)
def read_wishlist_items(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """Retrieve current user's wishlist items."""
    items, count = get_wishlist_items_for_user(
        session, current_user.id, skip=skip, limit=limit
    )
    return WishlistItemsPublic(
        data=[wishlist_item_to_public(item) for item in items],
        count=count,
    )


@router.get("/user/{user_id}", response_model=WishlistWithSettingsPublic)
def read_user_wishlist(
    session: SessionDep,
    current_user: CurrentUser,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    View another user's wishlist with their cooloff settings.

    Access is granted if:
    - You are the owner
    - The wishlist is public
    - The owner has shared their wishlist with you

    Returns the owner's cooloff settings so viewers can see accurate maturity states.
    """
    if not can_view_wishlist(session, current_user.id, user_id):
        raise PermissionDeniedError()

    items, count = get_wishlist_items_for_user(session, user_id, skip=skip, limit=limit)

    # Get owner's budget for cooloff settings
    owner_budget = get_or_create_budget(session, user_id)
    owner_cooloff_settings = CooloffSettingsPublic(
        cooloff_scaling_cents=owner_budget.cooloff_scaling_cents,
        cooloff_scaling_days=owner_budget.cooloff_scaling_days,
        cooloff_min_threshold_cents=owner_budget.cooloff_min_threshold_cents,
        cooloff_min_threshold_days=owner_budget.cooloff_min_threshold_days,
        cooloff_base_days=owner_budget.cooloff_base_days,
        cooloff_max_days=owner_budget.cooloff_max_days,
        freeze_penalty_days=owner_budget.freeze_penalty_days,
    )

    return WishlistWithSettingsPublic(
        data=[wishlist_item_to_public(item) for item in items],
        count=count,
        owner_cooloff_settings=owner_cooloff_settings,
    )


@router.get("/{item_id}", response_model=WishlistItemPublic)
def read_wishlist_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> WishlistItemPublic:
    """Get a specific wishlist item by ID."""
    item = get_owned_wishlist_item(session, item_id, current_user.id)
    return wishlist_item_to_public(item)


@router.post("/", response_model=WishlistedItemPublic | TrackedItemPublic)
async def create_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_in: WishlistItemCreate,
    background_tasks: BackgroundTasks,
) -> WishlistedItemPublic | TrackedItemPublic:
    """Add a new item to the wishlist.

    If tracking_number is provided, creates a TRACKING status item
    and automatically registers with 17track for tracking updates.
    Otherwise, creates a WISHLISTED status item.
    """
    item = create_wishlist_item(session, item_in, current_user.id)

    # Auto-register with 17track if tracking number provided
    if item.tracking_number and settings.tracking_enabled:
        from app.core.db import engine
        from app.features.tracking.service import register_and_sync_tracking

        async def sync_tracking() -> None:
            """Background task to register and sync tracking."""
            from sqlmodel import Session as SyncSession

            try:
                with SyncSession(engine) as bg_session:
                    bg_item = bg_session.get(type(item), item.id)
                    if bg_item:
                        await register_and_sync_tracking(bg_session, bg_item)
            except Exception as e:
                logger.warning(f"Failed to auto-sync tracking for item {item.id}: {e}")

        background_tasks.add_task(sync_tracking)

    public = wishlist_item_to_public(item)
    if not isinstance(public, WishlistedItemPublic | TrackedItemPublic):
        raise ValueError("Newly created item should be wishlisted or tracking")
    return public


@router.patch("/{item_id}", response_model=WishlistItemPublic)
def update_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    item_in: WishlistItemUpdate,
) -> WishlistItemPublic:
    """Update a wishlist item."""
    item = update_wishlist_item(session, item_id, item_in, current_user.id)
    return wishlist_item_to_public(item)


@router.delete("/{item_id}")
def delete_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> Message:
    """Delete a wishlist item."""
    delete_wishlist_item(session, item_id, current_user.id)
    return Message(message="Item deleted successfully")


class BulkDeleteResponse(SQLModel):
    """Response for bulk delete operation."""

    deleted_count: int


@router.delete("/items/bulk", response_model=BulkDeleteResponse)
def bulk_delete_items_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: BulkDeleteRequest,
) -> BulkDeleteResponse:
    """Delete multiple wishlist items at once."""
    count = bulk_delete_items(session, request.item_ids, current_user.id)
    return BulkDeleteResponse(deleted_count=count)


class BulkSetCategoriesResponse(SQLModel):
    """Response for bulk set categories operation."""

    updated_count: int


@router.patch("/items/categories", response_model=BulkSetCategoriesResponse)
def bulk_set_categories_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: BulkSetCategoriesRequest,
) -> BulkSetCategoriesResponse:
    """Set categories on multiple wishlist items at once."""
    count = bulk_set_categories(
        session, request.item_ids, request.category_ids, current_user.id
    )
    return BulkSetCategoriesResponse(updated_count=count)


class BulkArchiveResponse(SQLModel):
    """Response for bulk archive operation."""

    archived_count: int


@router.post("/items/archive", response_model=BulkArchiveResponse)
def bulk_archive_items_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: BulkArchiveRequest,
) -> BulkArchiveResponse:
    """Archive multiple wishlist items at once."""
    count = bulk_archive_items(session, request.item_ids, current_user.id)
    return BulkArchiveResponse(archived_count=count)


class BulkUnarchiveResponse(SQLModel):
    """Response for bulk unarchive operation."""

    unarchived_count: int


@router.post("/items/unarchive", response_model=BulkUnarchiveResponse)
def bulk_unarchive_items_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    request: BulkArchiveRequest,
) -> BulkUnarchiveResponse:
    """Unarchive multiple wishlist items at once."""
    count = bulk_unarchive_items(session, request.item_ids, current_user.id)
    return BulkUnarchiveResponse(unarchived_count=count)


@router.post("/{item_id}/purchase", response_model=PurchasedItemPublic)
async def purchase_item(
    session: SessionDep,
    item: OwnedWishlistItem,
    budget: CurrentUserBudget,
    background_tasks: BackgroundTasks,
    request: PurchaseRequest | None = None,
) -> PurchasedItemPublic:
    """
    Mark a wishlist item as purchased.

    Deducts the item price from the user's budget and marks the item as purchased.
    If the purchase is impulsive (item hasn't been on wishlist long enough based on
    cool-off settings), applies a freeze penalty to the budget.

    Optionally accepts tracking URL and actual price paid.
    If tracking_number is provided, auto-registers with 17track.
    """
    if item.status == WishlistItemStatus.PURCHASED:
        raise ValidationError("Item is already purchased")

    is_impulsive = is_purchase_impulsive(
        budget, item.added_at, item.price_cents, item.cooldown_waived_at
    )
    deduct_from_budget(session, budget, item.price_cents)

    if is_impulsive:
        apply_freeze(session, budget, budget.freeze_penalty_days)

    tracking_number = request.tracking_number if request else None
    purchased_item = mark_as_purchased(
        session,
        item,
        tracking_url=request.tracking_url if request else None,
        actual_price_paid_cents=request.actual_price_paid_cents if request else None,
        tracking_number=tracking_number,
        tracking_carrier=request.tracking_carrier if request else None,
    )

    # Auto-register with 17track if tracking number provided
    if tracking_number and settings.tracking_enabled:
        from app.core.db import engine
        from app.features.tracking.service import register_and_sync_tracking
        from app.features.wishlist_item.models import WishlistItem

        async def sync_tracking() -> None:
            """Background task to register and sync tracking."""
            from sqlmodel import Session as SyncSession

            try:
                with SyncSession(engine) as bg_session:
                    bg_item = bg_session.get(WishlistItem, purchased_item.id)
                    if bg_item:
                        await register_and_sync_tracking(bg_session, bg_item)
            except Exception as e:
                logger.warning(
                    f"Failed to auto-sync tracking for item {purchased_item.id}: {e}"
                )

        background_tasks.add_task(sync_tracking)

    return wishlist_item_to_public(purchased_item)  # type: ignore[return-value]


@router.post(
    "/{item_id}/undo",
    response_model=WishlistedItemPublic | ArchivedItemPublic,
)
def undo_item_endpoint(
    session: SessionDep,
    item: OwnedWishlistItem,
    budget: CurrentUserBudget,
    request: UndoRequest,
) -> WishlistedItemPublic | ArchivedItemPublic:
    """
    Undo a purchase or gift with flexible options.

    - **destination**: Move item to "wishlist" or "archive"
    - **refund_cents**: Amount to refund (None = item price, 0 = no refund, or custom amount)
    - **reason**: Audit trail reason

    Use cases:
    - Undo accidental purchase: destination=wishlist, refund_cents=None (full refund)
    - Sold purchased item: destination=archive, refund_cents=sale_price
    - Returned gift for credit: destination=archive, refund_cents=credit_amount
    - Exchanged gift: destination=archive, refund_cents=0
    """
    if item.status not in (WishlistItemStatus.PURCHASED, WishlistItemStatus.GIFTED):
        raise ValidationError("Item must be purchased or gifted to undo")

    # Handle budget refund
    refund_amount = request.refund_cents
    if refund_amount is None:
        refund_amount = item.price_cents
    if refund_amount > 0:
        add_to_budget(session, budget, refund_amount)

    undone_item = undo_item(session, item, request.destination.value, request.reason)
    return wishlist_item_to_public(undone_item)  # type: ignore[return-value]


@router.post("/{item_id}/waive-cooldown", response_model=WishlistedItemPublic)
def waive_cooldown(
    session: SessionDep,
    item: OwnedWishlistItem,
    budget: CurrentUserBudget,
    request: WaiveCooldownRequest,
) -> WishlistedItemPublic:
    """Waive cooldown period for a wishlisted item.

    Requires a reason. One-way operation - no undo.
    Item must be in cooldown period to waive.
    """
    if item.status != WishlistItemStatus.WISHLISTED:
        raise ValidationError("Can only waive cooldown on wishlisted items")

    # Check if item is actually in cooldown
    if not is_purchase_impulsive(budget, item.added_at, item.price_cents, None):
        raise ValidationError("Item is not currently in cooldown period")

    if item.cooldown_waived_at is not None:
        raise ValidationError("Cooldown already waived for this item")

    waived_item = waive_item_cooldown(session, item, request.reason)
    return wishlist_item_to_public(waived_item)  # type: ignore[return-value]


class AddCategoriesRequest(SQLModel):
    """Request body for adding categories to an item."""

    category_ids: list[uuid.UUID]


@router.get("/{item_id}/categories", response_model=CategoriesPublic)
def get_item_categories(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> CategoriesPublic:
    """Get categories for a wishlist item."""
    item = get_owned_wishlist_item(session, item_id, current_user.id)
    return CategoriesPublic(
        data=[category_to_public(category) for category in item.categories],
        count=len(item.categories),
    )


@router.post("/{item_id}/categories", response_model=CategoriesPublic)
def add_categories_to_item_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    request: AddCategoriesRequest,
) -> CategoriesPublic:
    """Add categories to a wishlist item."""
    item = add_categories_to_item(
        session, item_id, request.category_ids, current_user.id
    )
    return CategoriesPublic(
        data=[category_to_public(category) for category in item.categories],
        count=len(item.categories),
    )


@router.delete("/{item_id}/categories/{category_id}")
def remove_category_from_item_endpoint(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    category_id: uuid.UUID,
) -> Message:
    """Remove a category from a wishlist item."""
    remove_category_from_item(session, item_id, category_id, current_user.id)
    return Message(message="Category removed from item")


@router.post(
    "/{item_id}/toggle-most-desired",
    response_model=WishlistedItemPublic | PurchasedItemPublic,
)
def toggle_most_desired_endpoint(
    session: SessionDep,
    item: OwnedWishlistItem,
) -> WishlistedItemPublic | PurchasedItemPublic:
    """
    Toggle the most desired status of a wishlist item.

    Only one item per user can be marked as most desired at a time.
    Setting a new item as most desired will automatically clear the
    flag from any previously marked item.
    """
    updated_item = toggle_most_desired(session, item)
    return wishlist_item_to_public(updated_item)  # type: ignore[return-value]


@router.post("/{item_id}/gift", response_model=GiftedItemPublic)
def gift_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    request: GiftRequest | None = None,
) -> GiftedItemPublic:
    """
    Gift an item from someone else's wishlist.

    Marks the item as gifted with the current user as the gifter.
    Only works on wishlisted items that the current user has access to view.
    Does NOT affect the recipient's budget - gifts are free to receive.
    """
    item = get_wishlist_item(session, item_id)

    # Can't gift your own item
    if item.owner_id == current_user.id:
        raise ValidationError("Cannot gift your own item")

    # Must have access to view the wishlist
    if not can_view_wishlist(session, current_user.id, item.owner_id):
        raise PermissionDeniedError()

    # Only wishlisted items can be gifted
    if item.status != WishlistItemStatus.WISHLISTED:
        raise ValidationError("Only wishlisted items can be gifted")

    # Use provided display name or fall back to user's full name
    display_name = (
        request.gifter_display_name
        if request and request.gifter_display_name
        else current_user.full_name
    )

    gifted_item = mark_as_gifted(
        session,
        item,
        gifter_id=current_user.id,
        gift_message=request.gift_message if request else None,
        gifter_display_name=display_name,
        tracking_url=request.tracking_url if request else None,
    )

    return wishlist_item_to_public(gifted_item)  # type: ignore[return-value]
