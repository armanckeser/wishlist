import { useEffect, useState } from "react"

import type {
  ArchivedItemPublic,
  GiftedItemPublic,
  PurchasedItemPublic,
  TrackedItemPublic,
  WishlistedItemPublic,
} from "@/client"
import type { WishlistItemPublic } from "@/types"

import type { GiftOptions, PurchaseOptions } from "../context"
import {
  ArchivedDrawer as OwnerArchivedDrawer,
  GiftedDrawer as OwnerGiftedDrawer,
  PurchasedDrawer as OwnerPurchasedDrawer,
  TrackedDrawer as OwnerTrackedDrawer,
  WishlistedDrawer as OwnerWishlistedDrawer,
} from "./owner"
import { WishlistedDrawer as ViewerWishlistedDrawer } from "./viewer"

interface ItemDrawerProps {
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  isOwner: boolean
  onEdit?: (item: WishlistItemPublic) => void
  onArchive?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
  onBuy?: (item: WishlistItemPublic, options?: PurchaseOptions) => void
  onGift?: (item: WishlistItemPublic, options?: GiftOptions) => void
}

/**
 * Router component that selects the appropriate drawer preset
 * based on ownership and item status.
 *
 * Owner views:
 * - wishlisted: full actions (edit, archive, delete, buy)
 * - purchased: undo purchase, delete
 * - gifted: read-only gift info
 * - archived: unarchive, delete
 *
 * Viewer views:
 * - wishlisted: gift action only
 * - other statuses: viewers don't see these
 */
export function ItemDrawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  isOwner,
  onEdit,
  onArchive,
  onDelete,
  onBuy,
  onGift,
}: ItemDrawerProps) {
  // Keep item stable during close animation to prevent content flash
  // and ensure proper drawer behavior (animation, overlay blocking)
  const [stableItem, setStableItem] = useState<WishlistItemPublic | null>(item)

  useEffect(() => {
    if (item) {
      setStableItem(item)
    }
    // Don't clear when item becomes null - wait for drawer to close
  }, [item])

  // Clear stable item when drawer finishes closing
  const handleCloseComplete = () => {
    setStableItem(null)
    onCloseComplete?.()
  }

  // Nothing to render if we never had an item
  if (!stableItem) {
    return null
  }

  if (isOwner) {
    switch (stableItem.status) {
      case "wishlisted":
        return (
          <OwnerWishlistedDrawer
            item={stableItem as WishlistedItemPublic}
            open={open}
            onOpenChange={onOpenChange}
            onCloseComplete={handleCloseComplete}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onBuy={onBuy}
          />
        )
      case "purchased":
        return (
          <OwnerPurchasedDrawer
            item={stableItem as PurchasedItemPublic}
            open={open}
            onOpenChange={onOpenChange}
            onCloseComplete={handleCloseComplete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      case "gifted":
        return (
          <OwnerGiftedDrawer
            item={stableItem as GiftedItemPublic}
            open={open}
            onOpenChange={onOpenChange}
            onCloseComplete={handleCloseComplete}
            onEdit={onEdit}
          />
        )
      case "archived":
        return (
          <OwnerArchivedDrawer
            item={stableItem as ArchivedItemPublic}
            open={open}
            onOpenChange={onOpenChange}
            onCloseComplete={handleCloseComplete}
            onDelete={onDelete}
            onUnarchive={onArchive}
          />
        )
      case "tracking":
        return (
          <OwnerTrackedDrawer
            item={stableItem as TrackedItemPublic}
            open={open}
            onOpenChange={onOpenChange}
            onCloseComplete={handleCloseComplete}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
    }
  }

  // Viewer - only wishlisted items are viewable
  if (stableItem.status === "wishlisted") {
    return (
      <ViewerWishlistedDrawer
        item={stableItem as WishlistedItemPublic}
        open={open}
        onOpenChange={onOpenChange}
        onCloseComplete={handleCloseComplete}
        onGift={onGift}
      />
    )
  }

  // Viewer shouldn't see purchased/gifted/archived items
  return null
}
