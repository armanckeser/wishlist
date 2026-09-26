import { RotateCcw } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { UndoDialog } from "@/components/Wishlist/UndoDialog"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

interface UndoTrackingProps {
  className?: string
}

/**
 * Button to undo tracking status.
 * Only renders for tracked items.
 * Opens confirmation dialog before undoing.
 */
export function UndoTracking({ className }: UndoTrackingProps) {
  const { item } = useWishlistItem()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Only show for tracked items
  const isTracked = item.status === "tracking"
  if (!isTracked) {
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
