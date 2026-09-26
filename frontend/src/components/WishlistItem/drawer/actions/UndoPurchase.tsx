import { RotateCcw } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { UndoDialog } from "@/components/Wishlist/UndoDialog"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

interface UndoPurchaseProps {
  className?: string
}

/**
 * Button to undo a purchase or gift.
 * Only renders for purchased or gifted items.
 * Opens confirmation dialog before undoing.
 */
export function UndoPurchase({ className }: UndoPurchaseProps) {
  const { item, isPurchased, isGifted } = useWishlistItem()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Only show for purchased or gifted items
  if (!isPurchased && !isGifted) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn("h-12 flex-1", className)}
        onClick={() => setDialogOpen(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Undo
      </Button>

      <UndoDialog item={item} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
