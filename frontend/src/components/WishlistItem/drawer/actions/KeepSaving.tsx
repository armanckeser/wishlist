import { KeepSavingButton } from "@/components/Wishlist/KeepSavingButton"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

interface KeepSavingProps {
  className?: string
}

/**
 * Keep Saving button for ready-to-treat items.
 * Only renders when item is ready to treat.
 * Closes drawer after animation completes.
 */
export function KeepSaving({ className }: KeepSavingProps) {
  const { isReadyToTreat, isPurchased, close, actions } = useWishlistItem()
  const { onBuy } = actions

  // Only show for owners with ready-to-treat, non-purchased items
  if (!onBuy || isPurchased || !isReadyToTreat) {
    return null
  }

  return (
    <KeepSavingButton onComplete={close} className={cn("h-12", className)} />
  )
}
