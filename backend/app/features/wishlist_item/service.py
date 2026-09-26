"""WishlistItem service for database operations."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Session, func, select

from app.core.exceptions import NotFoundError
from app.features.category.models import Category
from app.features.category.service import category_to_public
from app.features.notification.models import NotificationType
from app.features.notification.service import create_notification
from app.features.price_tracking.service import (
    PriceObservation,
    reset_tracking,
    seed_tracking,
    tracking_to_public,
)
from app.features.tracking.models import (
    DeliveryStatus,
    TrackInfo,
    TrackingEventPublic,
)
from app.features.wishlist_item.models import (
    ArchivedItemPublic,
    GiftedItemPublic,
    PurchasedItemPublic,
    TrackedItemPublic,
    WishlistedItemPublic,
    WishlistItem,
    WishlistItemCreate,
    WishlistItemStatus,
    WishlistItemUpdate,
)

if TYPE_CHECKING:
    pass


class TrackingInfo:
    """Derived tracking information from stored tracking_data."""

    def __init__(
        self,
        status: DeliveryStatus | None = None,
        status_label: str | None = None,
        events: list[TrackingEventPublic] | None = None,
    ) -> None:
        self.status = status
        self.status_label = status_label
        self.events = events or []


def _derive_tracking_info(tracking_data: dict | None) -> TrackingInfo:
    """Derive tracking status, label, and events from stored tracking_data JSON.

    Args:
        tracking_data: Raw JSON data from 17track stored in the item.

    Returns:
        TrackingInfo with status, label, and events.
    """
    if not tracking_data:
        return TrackingInfo()

    try:
        track_info = TrackInfo.model_validate(tracking_data)
        status = track_info.normalized_status
        status_label = status.value.replace("_", " ").title()

        # Extract events from track_info
        events: list[TrackingEventPublic] = []
        for event in track_info.events:
            # Build location string from address components
            location_parts = []
            if event.address:
                if event.address.city:
                    location_parts.append(event.address.city)
                if event.address.state:
                    location_parts.append(event.address.state)
                if event.address.country:
                    location_parts.append(event.address.country)
            location = ", ".join(location_parts) if location_parts else event.location

            events.append(
                TrackingEventPublic(
                    timestamp=event.timestamp,
                    description=event.description,
                    location=location,
                )
            )

        return TrackingInfo(status=status, status_label=status_label, events=events)
    except Exception:
        return TrackingInfo()


def create_wishlist_item(
    session: Session,
    item_create: WishlistItemCreate,
    owner_id: uuid.UUID,
) -> WishlistItem:
    """Create a new wishlist item with optional categories.

    If tracking_number is provided, item is created with TRACKING status.
    """
    create_data = item_create.model_dump(exclude={"category_ids", "price_from_url"})

    # Determine status based on tracking fields
    if item_create.tracking_number:
        create_data["status"] = WishlistItemStatus.TRACKING

    db_item = WishlistItem.model_validate(create_data, update={"owner_id": owner_id})
    session.add(db_item)
    session.flush()

    # Automatic price tracking: only when the price was pulled from the URL,
    # so we know the page is one we can read.
    if (
        item_create.price_from_url
        and db_item.product_url
        and db_item.price_cents > 0
        and db_item.status == WishlistItemStatus.WISHLISTED
    ):
        seed_tracking(session, db_item, PriceObservation(db_item.price_cents))

    if item_create.category_ids:
        for category_id in item_create.category_ids:
            category = session.get(Category, category_id)
            if category and category.owner_id == owner_id:
                db_item.categories.append(category)

    session.commit()
    session.refresh(db_item)
    return db_item


def get_wishlist_items_for_user(
    session: Session,
    owner_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[WishlistItem], int]:
    """Get all wishlist items for a user with pagination."""
    count_statement = (
        select(func.count())
        .select_from(WishlistItem)
        .where(WishlistItem.owner_id == owner_id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(WishlistItem)
        .where(WishlistItem.owner_id == owner_id)
        .offset(skip)
        .limit(limit)
    )
    items = list(session.exec(statement).all())

    return items, count


def wishlist_item_to_public(
    item: WishlistItem,
) -> (
    WishlistedItemPublic
    | PurchasedItemPublic
    | GiftedItemPublic
    | ArchivedItemPublic
    | TrackedItemPublic
):
    """Convert a WishlistItem to its public representation."""
    categories_public = [category_to_public(category) for category in item.categories]

    if item.status == WishlistItemStatus.PURCHASED:
        if item.purchased_at is None:
            raise ValueError("Purchased item must have purchased_at set")
        tracking_info = _derive_tracking_info(item.tracking_data)
        return PurchasedItemPublic(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            description=item.description,
            price_cents=item.price_cents,
            image_url=item.image_url,
            product_url=item.product_url,
            added_at=item.added_at,
            status="purchased",
            purchased_at=item.purchased_at,
            is_most_desired=item.is_most_desired,
            categories=categories_public,
            tracking_url=item.tracking_url,
            actual_price_paid_cents=item.actual_price_paid_cents,
            tracking_number=item.tracking_number,
            tracking_carrier=item.tracking_carrier,
            estimated_delivery_at=item.estimated_delivery_at,
            tracking_synced_at=item.tracking_synced_at,
            tracking_status=tracking_info.status,
            tracking_status_label=tracking_info.status_label,
            tracking_events=tracking_info.events,
        )
    if item.status == WishlistItemStatus.GIFTED:
        if item.gifted_at is None:
            raise ValueError("Gifted item must have gifted_at set")
        if item.bought_by_id is None:
            raise ValueError("Gifted item must have bought_by_id set")
        tracking_info = _derive_tracking_info(item.tracking_data)
        return GiftedItemPublic(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            description=item.description,
            price_cents=item.price_cents,
            image_url=item.image_url,
            product_url=item.product_url,
            added_at=item.added_at,
            status="gifted",
            gifted_at=item.gifted_at,
            bought_by_id=item.bought_by_id,
            gifter_display_name=item.gifter_display_name,
            gift_message=item.gift_message,
            tracking_url=item.tracking_url,
            is_most_desired=item.is_most_desired,
            categories=categories_public,
            tracking_number=item.tracking_number,
            tracking_carrier=item.tracking_carrier,
            estimated_delivery_at=item.estimated_delivery_at,
            tracking_synced_at=item.tracking_synced_at,
            tracking_status=tracking_info.status,
            tracking_status_label=tracking_info.status_label,
            tracking_events=tracking_info.events,
        )
    if item.status == WishlistItemStatus.ARCHIVED:
        if item.archived_at is None:
            raise ValueError("Archived item must have archived_at set")
        return ArchivedItemPublic(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            description=item.description,
            price_cents=item.price_cents,
            image_url=item.image_url,
            product_url=item.product_url,
            added_at=item.added_at,
            status="archived",
            archived_at=item.archived_at,
            is_most_desired=item.is_most_desired,
            categories=categories_public,
        )
    if item.status == WishlistItemStatus.TRACKING:
        tracking_info = _derive_tracking_info(item.tracking_data)
        return TrackedItemPublic(
            id=item.id,
            owner_id=item.owner_id,
            title=item.title,
            description=item.description,
            price_cents=item.price_cents,
            image_url=item.image_url,
            product_url=item.product_url,
            added_at=item.added_at,
            status="tracking",
            is_most_desired=item.is_most_desired,
            categories=categories_public,
            tracking_number=item.tracking_number,
            tracking_carrier=item.tracking_carrier,
            tracking_url=item.tracking_url,
            estimated_delivery_at=item.estimated_delivery_at,
            tracking_synced_at=item.tracking_synced_at,
            tracking_status=tracking_info.status,
            tracking_status_label=tracking_info.status_label,
            tracking_events=tracking_info.events,
        )
    return WishlistedItemPublic(
        id=item.id,
        owner_id=item.owner_id,
        title=item.title,
        description=item.description,
        price_cents=item.price_cents,
        image_url=item.image_url,
        product_url=item.product_url,
        added_at=item.added_at,
        status="wishlisted",
        is_most_desired=item.is_most_desired,
        categories=categories_public,
        cooldown_waived_at=item.cooldown_waived_at,
        price_tracking=tracking_to_public(item),
    )


def mark_as_purchased(
    session: Session,
    item: WishlistItem,
    tracking_url: str | None = None,
    actual_price_paid_cents: int | None = None,
    tracking_number: str | None = None,
    tracking_carrier: str | None = None,
) -> WishlistItem:
    """
    Mark a wishlist item as purchased.

    Sets status to PURCHASED and records the purchase timestamp.
    Clears any previous undo data.

    Args:
        session: Database session.
        item: The wishlist item to mark as purchased.
        tracking_url: Optional URL to track the purchase/shipment.
        actual_price_paid_cents: Optional actual price paid (may differ from listed price).
        tracking_number: Optional tracking number for package tracking.
        tracking_carrier: Optional carrier name (FedEx, UPS, USPS, etc.).

    Raises:
        ValueError: If item is already purchased.
    """
    if item.status == WishlistItemStatus.PURCHASED:
        raise ValueError("Item is already purchased")

    item.status = WishlistItemStatus.PURCHASED
    item.purchased_at = datetime.now(timezone.utc)
    item.tracking_url = tracking_url
    item.actual_price_paid_cents = actual_price_paid_cents
    item.tracking_number = tracking_number
    item.tracking_carrier = tracking_carrier
    # Clear previous undo data
    item.undo_reason = None
    item.undone_at = None

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def mark_as_gifted(
    session: Session,
    item: WishlistItem,
    gifter_id: uuid.UUID,
    gift_message: str | None = None,
    gifter_display_name: str | None = None,
    tracking_url: str | None = None,
) -> WishlistItem:
    """
    Mark a wishlist item as gifted by someone.

    Sets status to GIFTED and records gift details.

    Args:
        session: Database session.
        item: The wishlist item to mark as gifted.
        gifter_id: UUID of the user giving the gift.
        gift_message: Optional message from the gifter.
        gifter_display_name: Optional display name for the gifter.
        tracking_url: Optional URL to track the shipment.

    Raises:
        ValueError: If item is not in wishlisted status.
    """
    if item.status != WishlistItemStatus.WISHLISTED:
        raise ValueError("Only wishlisted items can be gifted")

    item.status = WishlistItemStatus.GIFTED
    item.gifted_at = datetime.now(timezone.utc)
    item.bought_by_id = gifter_id
    item.gift_message = gift_message
    item.gifter_display_name = gifter_display_name
    item.tracking_url = tracking_url

    session.add(item)
    session.commit()
    session.refresh(item)

    # Create notification for the recipient (keep the surprise!)
    create_notification(
        session,
        user_id=item.owner_id,
        notification_type=NotificationType.GIFT_RECEIVED,
        title="Someone got you a gift!",
        message="Open the app to see what it is.",
        payload={
            "item_id": str(item.id),
            "item_title": item.title,
            "item_image_url": item.image_url,
            "gifter_id": str(gifter_id),
            "gifter_name": gifter_display_name or "Someone",
            "gift_message": gift_message,
        },
    )

    return item


def undo_item(
    session: Session,
    item: WishlistItem,
    destination: str,
    reason: str | None = None,
) -> WishlistItem:
    """
    Undo a purchase or gift - move item to wishlist or archive.

    Clears status-specific fields based on current status.
    Budget handling should be done separately by the caller.

    Args:
        session: Database session.
        item: The item to undo.
        destination: "wishlist" or "archive".
        reason: Optional reason for undoing (audit trail).

    Raises:
        ValueError: If item is not purchased or gifted.
    """
    if item.status not in (WishlistItemStatus.PURCHASED, WishlistItemStatus.GIFTED):
        raise ValueError("Item must be purchased or gifted to undo")

    now = datetime.now(timezone.utc)

    # Clear purchased-specific fields
    if item.status == WishlistItemStatus.PURCHASED:
        item.purchased_at = None
        item.actual_price_paid_cents = None

    # Clear gift-specific fields
    if item.status == WishlistItemStatus.GIFTED:
        item.gifted_at = None
        item.bought_by_id = None
        item.gift_message = None
        item.gifter_display_name = None

    # Clear shared fields
    item.tracking_url = None

    # Set new status based on destination
    if destination == "archive":
        item.status = WishlistItemStatus.ARCHIVED
        item.archived_at = now
    else:
        item.status = WishlistItemStatus.WISHLISTED

    # Record undo metadata
    item.undo_reason = reason
    item.undone_at = now

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def get_owned_wishlist_item(
    session: Session,
    item_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> WishlistItem:
    """
    Get a wishlist item by ID, verifying ownership.

    Raises:
        NotFoundError: If item doesn't exist or doesn't belong to user.
    """
    item = session.get(WishlistItem, item_id)
    if not item or item.owner_id != owner_id:
        raise NotFoundError("Item")
    return item


def get_wishlist_item(
    session: Session,
    item_id: uuid.UUID,
) -> WishlistItem:
    """
    Get a wishlist item by ID without ownership check.

    Used for operations where access is verified separately (e.g., gifting).

    Raises:
        NotFoundError: If item doesn't exist.
    """
    item = session.get(WishlistItem, item_id)
    if not item:
        raise NotFoundError("Item")
    return item


def update_wishlist_item(
    session: Session,
    item_id: uuid.UUID,
    item_update: WishlistItemUpdate,
    owner_id: uuid.UUID,
) -> WishlistItem:
    """
    Update a wishlist item.

    Raises:
        NotFoundError: If item doesn't exist.
        PermissionDeniedError: If item doesn't belong to user.
    """
    item = get_owned_wishlist_item(session, item_id, owner_id)
    update_dict = item_update.model_dump(exclude_unset=True, exclude={"category_ids"})

    # A different product page means our price history no longer applies and
    # the new page has to prove it can be parsed before tracking resumes.
    new_url = update_dict.get("product_url", item.product_url)
    if new_url != item.product_url:
        reset_tracking(session, item)

    item.sqlmodel_update(update_dict)

    if item_update.category_ids is not None:
        item.categories.clear()
        for category_id in item_update.category_ids:
            category = session.get(Category, category_id)
            if category and category.owner_id == owner_id:
                item.categories.append(category)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def delete_wishlist_item(
    session: Session,
    item_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    """
    Delete a wishlist item.

    Raises:
        NotFoundError: If item doesn't exist.
        PermissionDeniedError: If item doesn't belong to user.
    """
    item = get_owned_wishlist_item(session, item_id, owner_id)
    session.delete(item)
    session.commit()


def add_categories_to_item(
    session: Session,
    item_id: uuid.UUID,
    category_ids: list[uuid.UUID],
    owner_id: uuid.UUID,
) -> WishlistItem:
    """
    Add categories to a wishlist item.

    Raises:
        NotFoundError: If item or category doesn't exist or doesn't belong to user.
    """
    item = get_owned_wishlist_item(session, item_id, owner_id)
    existing_category_ids = {category.id for category in item.categories}

    for category_id in category_ids:
        if category_id in existing_category_ids:
            continue
        category = session.get(Category, category_id)
        if not category or category.owner_id != owner_id:
            raise NotFoundError("Category")
        item.categories.append(category)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def remove_category_from_item(
    session: Session,
    item_id: uuid.UUID,
    category_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> WishlistItem:
    """
    Remove a category from a wishlist item.

    Raises:
        NotFoundError: If item doesn't exist or category not on item.
        PermissionDeniedError: If item doesn't belong to user.
    """
    item = get_owned_wishlist_item(session, item_id, owner_id)

    category_to_remove = None
    for category in item.categories:
        if category.id == category_id:
            category_to_remove = category
            break

    if not category_to_remove:
        raise NotFoundError("Category on item")

    item.categories.remove(category_to_remove)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def bulk_delete_items(
    session: Session,
    item_ids: list[uuid.UUID],
    owner_id: uuid.UUID,
) -> int:
    """
    Delete multiple wishlist items at once.

    Only deletes items that belong to the owner.
    Returns the count of items actually deleted.
    """
    statement = select(WishlistItem).where(
        WishlistItem.id.in_(item_ids),
        WishlistItem.owner_id == owner_id,
    )
    items = list(session.exec(statement).all())

    for item in items:
        session.delete(item)

    session.commit()
    return len(items)


def bulk_set_categories(
    session: Session,
    item_ids: list[uuid.UUID],
    category_ids: list[uuid.UUID],
    owner_id: uuid.UUID,
) -> int:
    """
    Set categories on multiple wishlist items at once.

    Replaces existing categories on each item with the specified categories.
    Only modifies items that belong to the owner.
    Returns the count of items modified.
    """
    # Get items that belong to owner
    items_statement = select(WishlistItem).where(
        WishlistItem.id.in_(item_ids),
        WishlistItem.owner_id == owner_id,
    )
    items = list(session.exec(items_statement).all())

    # Get categories that belong to owner
    categories: list[Category] = []
    if category_ids:
        categories_statement = select(Category).where(
            Category.id.in_(category_ids),
            Category.owner_id == owner_id,
        )
        categories = list(session.exec(categories_statement).all())

    # Update each item's categories
    for item in items:
        item.categories.clear()
        for category in categories:
            item.categories.append(category)
        session.add(item)

    session.commit()
    return len(items)


def bulk_archive_items(
    session: Session,
    item_ids: list[uuid.UUID],
    owner_id: uuid.UUID,
) -> int:
    """
    Archive multiple wishlist items at once.

    Only archives items that belong to the owner and are not already archived.
    Returns the count of items actually archived.
    """
    statement = select(WishlistItem).where(
        WishlistItem.id.in_(item_ids),
        WishlistItem.owner_id == owner_id,
        WishlistItem.status != WishlistItemStatus.ARCHIVED,
    )
    items = list(session.exec(statement).all())

    now = datetime.now(timezone.utc)
    for item in items:
        item.status = WishlistItemStatus.ARCHIVED
        item.archived_at = now
        session.add(item)

    session.commit()
    return len(items)


def bulk_unarchive_items(
    session: Session,
    item_ids: list[uuid.UUID],
    owner_id: uuid.UUID,
) -> int:
    """
    Unarchive multiple wishlist items at once.

    Only unarchives items that belong to the owner and are currently archived.
    Returns the count of items actually unarchived.
    """
    statement = select(WishlistItem).where(
        WishlistItem.id.in_(item_ids),
        WishlistItem.owner_id == owner_id,
        WishlistItem.status == WishlistItemStatus.ARCHIVED,
    )
    items = list(session.exec(statement).all())

    for item in items:
        item.status = WishlistItemStatus.WISHLISTED
        item.archived_at = None
        session.add(item)

    session.commit()
    return len(items)


def set_most_desired(
    session: Session,
    item: WishlistItem,
) -> WishlistItem:
    """
    Mark an item as most desired.

    Clears the most_desired flag from any other item belonging to the same owner,
    ensuring only one item can be most desired at a time.
    """
    clear_statement = select(WishlistItem).where(
        WishlistItem.owner_id == item.owner_id,
        WishlistItem.is_most_desired == True,  # noqa: E712
        WishlistItem.id != item.id,
    )
    previously_most_desired = list(session.exec(clear_statement).all())
    for prev_item in previously_most_desired:
        prev_item.is_most_desired = False
        session.add(prev_item)

    item.is_most_desired = True
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def clear_most_desired(
    session: Session,
    item: WishlistItem,
) -> WishlistItem:
    """Remove the most desired designation from an item."""
    item.is_most_desired = False
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


def toggle_most_desired(
    session: Session,
    item: WishlistItem,
) -> WishlistItem:
    """Toggle the most desired status of an item."""
    if item.is_most_desired:
        return clear_most_desired(session, item)
    return set_most_desired(session, item)


def waive_item_cooldown(
    session: Session,
    item: WishlistItem,
    reason: str,
) -> WishlistItem:
    """Waive cooldown period for an item.

    Sets waived timestamp and appends reason to description.
    """
    item.cooldown_waived_at = datetime.now(timezone.utc)

    # Append waiver note to description
    waiver_note = f"\n\nCooldown waived: {reason}"
    item.description = (item.description or "") + waiver_note

    session.add(item)
    session.commit()
    session.refresh(item)
    return item
