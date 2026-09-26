import { AlertTriangle } from "lucide-react"

import { useWishlistItem } from "../../context"

/**
 * Warning alert shown when buying a cooling item.
 * Only renders for cooling (immature) items when user can purchase.
 */
export function CoolingWarning() {
  const {
    maturity,
    isCooling,
    isPurchased,
    isArchived,
    freezePenaltyDays,
    actions,
  } = useWishlistItem()
  const { onBuy } = actions

  // Only show for owners who can buy, for cooling items that aren't purchased/archived
  if (!onBuy || isPurchased || isArchived || !isCooling) {
    return null
  }

  const daysToWait = maturity.daysRequired - maturity.daysWishlisted

  return (
    <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-destructive">
        Buying now will freeze your budget for {freezePenaltyDays} days.
        Consider waiting {daysToWait} more day{daysToWait !== 1 ? "s" : ""}.
      </p>
    </div>
  )
}
