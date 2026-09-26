import type {
  ArchivedItemPublic,
  GiftedItemPublic,
  PurchasedItemPublic,
  TrackedItemPublic,
  WishlistedItemPublic,
} from "@/client"

/**
 * Union type for all wishlist item states.
 * Use this when working with items that can be wishlisted, purchased, gifted, archived, or tracking.
 */
export type WishlistItemPublic =
  | WishlistedItemPublic
  | PurchasedItemPublic
  | GiftedItemPublic
  | ArchivedItemPublic
  | TrackedItemPublic
