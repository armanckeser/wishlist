import { Link2Off } from "lucide-react"

import type { PriceTrackingPublic } from "@/client"
import { cn } from "@/lib/utils"

/** The failures the owner has to fix - the rest resolve on their own. */
const NEEDS_ATTENTION = new Set(["link_moved", "different_product"])

interface PriceAlertIconProps {
  tracking: PriceTrackingPublic | null | undefined
  className?: string
}

/**
 * Marks an item in a list whose product link stopped pointing at it.
 *
 * Icon only: it exists to draw the eye, and the drawer carries the
 * explanation and the fix.
 */
export function PriceAlertIcon({ tracking, className }: PriceAlertIconProps) {
  const reason = tracking?.last_error_reason
  if (!reason || !NEEDS_ATTENTION.has(reason)) return null

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground/70",
        className,
      )}
    >
      <Link2Off className="h-3 w-3" aria-hidden />
      <span className="sr-only">Link needs updating</span>
    </span>
  )
}
