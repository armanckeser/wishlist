import { Gift } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"
import { GiftDialog } from "./GiftDialog"

interface GiftButtonProps {
  className?: string
}

/**
 * Button to gift an item to the wishlist owner.
 * Opens GiftDialog to collect optional message and tracking info.
 * Only renders if onGift action is provided.
 */
export function GiftButton({ className }: GiftButtonProps) {
  const { item, actions } = useWishlistItem()
  const { onGift } = actions
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!onGift) {
    return null
  }

  const handleClick = () => {
    setDialogOpen(true)
  }

  const handleConfirm = (data: {
    giftMessage?: string
    gifterDisplayName?: string
    trackingUrl?: string
  }) => {
    onGift(item, data)
    setDialogOpen(false)
  }

  return (
    <>
      <Button className={cn("h-12 flex-1", className)} onClick={handleClick}>
        <Gift className="mr-2 h-4 w-4" />
        Gift This
      </Button>
      <GiftDialog
        item={item}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirm}
      />
    </>
  )
}
