import { ItemDialog } from "@/components/Items/ItemDialog"
import type { WishlistItemPublic } from "@/types"

interface EditItemDialogProps {
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for editing a wishlist item.
 * Thin wrapper around ItemDialog with edit mode.
 */
export function EditItemDialog({
  item,
  open,
  onOpenChange,
}: EditItemDialogProps) {
  return (
    <ItemDialog
      mode="edit"
      item={item}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}
