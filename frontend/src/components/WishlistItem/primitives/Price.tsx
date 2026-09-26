import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"
import { formatPrice } from "../utils"

interface PriceProps {
  className?: string
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl"
}

/**
 * Formatted price display.
 * For purchased items with actual_price_paid_cents:
 * - If paid more than list price: show paid price only (don't remind of overpay)
 * - If paid less than list price: show original struck through + paid price (celebrate savings)
 */
export function Price({ className, size = "md" }: PriceProps) {
  const { item } = useWishlistItem()

  const sizeClasses = cn(
    size === "sm" && "text-sm",
    size === "md" && "text-base",
    size === "lg" && "text-lg",
    size === "xl" && "text-3xl",
  )

  const baseClasses = cn(
    "font-display font-light tracking-tight text-foreground",
    sizeClasses,
    className,
  )

  // Check if this is a purchased item with an actual price paid
  const actualPricePaid =
    item.status === "purchased" ? item.actual_price_paid_cents : null

  // Tracked wishlisted item whose price dropped since it was added:
  // show the original struck through so the saving is visible.
  const trackedOriginal =
    item.status === "wishlisted" && item.price_tracking?.enabled
      ? item.price_tracking.original_price_cents
      : null
  if (trackedOriginal != null && trackedOriginal > item.price_cents) {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5", className)}>
        <span
          className={cn(
            "font-display font-light tracking-tight text-muted-foreground line-through",
            sizeClasses,
          )}
        >
          ${formatPrice(trackedOriginal)}
        </span>
        <span
          className={cn(
            "font-display font-light tracking-tight text-foreground",
            sizeClasses,
          )}
        >
          ${formatPrice(item.price_cents)}
        </span>
      </span>
    )
  }

  // No actual price recorded, or same as list price - show original
  if (actualPricePaid == null || actualPricePaid === item.price_cents) {
    return <span className={baseClasses}>${formatPrice(item.price_cents)}</span>
  }

  // Paid more than list price - just show what was paid (don't remind of overpay)
  if (actualPricePaid > item.price_cents) {
    return <span className={baseClasses}>${formatPrice(actualPricePaid)}</span>
  }

  // Paid less than list price - show original struck through + paid price
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-display font-light tracking-tight text-muted-foreground line-through",
          sizeClasses,
        )}
      >
        ${formatPrice(item.price_cents)}
      </span>
      <span
        className={cn(
          "font-display font-light tracking-tight text-foreground",
          sizeClasses,
        )}
      >
        ${formatPrice(actualPricePaid)}
      </span>
    </span>
  )
}
