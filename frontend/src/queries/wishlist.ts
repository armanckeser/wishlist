import { WishlistService } from "@/client"

/**
 * Query options for fetching wishlist items.
 */
export function wishlistQueryOptions() {
  return {
    queryFn: () => WishlistService.readWishlistItems({ skip: 0, limit: 100 }),
    queryKey: ["wishlist"] as const,
  }
}
