import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface GiftBadgeProps {
  className?: string
  /** Show gifter name if available */
  showGifter?: boolean
}

/**
 * Gift indicator for gifted items.
 * Shows subtle text matching the app's design language.
 * Only renders for items with status="gifted".
 */
export function GiftBadge({ className, showGifter = true }: GiftBadgeProps) {
  const { item, isGifted } = useWishlistItem()

  if (!isGifted) return null

  const gifterName = item.status === "gifted" ? item.gifter_display_name : null
  const displayText =
    showGifter && gifterName ? `Gift from ${gifterName}` : "Gift"

  return (
    <p
      className={cn(
        "text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70",
        className,
      )}
    >
      {displayText}
    </p>
  )
}
