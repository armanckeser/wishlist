import type { WishlistItemPublic } from "@/types"
import { useDialogPair } from "./useDialogPair"

/**
 * Combined hook for managing all wishlist item dialogs.
 * Provides state and handlers for edit and delete dialogs.
 */
export function useWishlistDialogs() {
  const editDialog = useDialogPair<WishlistItemPublic>()
  const deleteDialog = useDialogPair<WishlistItemPublic>()

  return {
    editDialog,
    deleteDialog,
  }
}
