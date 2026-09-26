import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import type { PriceTrackingPublic } from "@/client"
import { cn } from "@/lib/utils"

import { percentChange } from "./format"

interface PriceChangeChipProps {
  tracking: PriceTrackingPublic | null | undefined
  currentPriceCents: number
  className?: string
  /** Compare against the price when tracking started (default) or the previous reading. */
  compareTo?: "original" | "previous"
}

/**
 * Tiny "↓ 12%" / "↑ 8%" indicator for tracked items whose price moved.
 * Renders nothing when tracking is off or the price hasn't changed.
 * Direction carries the color (a drop is good news, a rise is not).
 */
export function PriceChangeChip({
  tracking,
  currentPriceCents,
  className,
  compareTo = "original",
}: PriceChangeChipProps) {
  if (!tracking?.enabled) return null
  const reference =
    compareTo === "original"
      ? tracking.original_price_cents
      : tracking.previous_price_cents
  if (reference == null || reference === currentPriceCents) return null

  const pct = percentChange(reference, currentPriceCents)
  if (pct === 0) return null
  const dropped = pct < 0
  const Icon = dropped ? ArrowDownRight : ArrowUpRight

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums",
        dropped ? "text-price-drop" : "text-price-rise",
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
      <span aria-hidden>{Math.abs(pct)}%</span>
      <span className="sr-only">
        Price {dropped ? "dropped" : "rose"} {Math.abs(pct)}% since added
      </span>
    </span>
  )
}
