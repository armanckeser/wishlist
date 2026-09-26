import { useState } from "react"

import { MaturityProgress } from "@/components/Wishlist/MaturityProgress"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"
import { formatRelativeTime, formatTimeUntilReady } from "../../utils"

/**
 * Maturity info for wishlisted items.
 * Shows progress bar, time remaining, and state label.
 * Tappable to toggle between state label and "added X ago".
 */
export function WishlistedInfo() {
  const { maturity } = useWishlistItem()
  const [showAddedDate, setShowAddedDate] = useState(false)

  const formatAddedText = (days: number): string => {
    const relative = formatRelativeTime(days)
    return relative === "today" ? "Added today" : `Added ${relative} ago`
  }

  const addedText = formatAddedText(maturity.daysWishlisted)

  return (
    <div className="space-y-2 pt-2">
      {/* Progress bar with time remaining */}
      <div className="flex items-center gap-3">
        <MaturityProgress
          progress={maturity.progress}
          state={maturity.state}
          className="flex-1"
        />
        <span
          className={cn(
            "text-xs tabular-nums",
            maturity.state === "ready"
              ? "text-milestone-gold"
              : "text-muted-foreground",
          )}
        >
          {formatTimeUntilReady(maturity.daysUntilReady)}
        </span>
      </div>

      {/* State label - tappable to toggle "added X ago" */}
      <button
        type="button"
        onClick={() => setShowAddedDate(!showAddedDate)}
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.2em] transition-colors",
          "hover:opacity-80 active:opacity-60",
          maturity.state === "cooling" && "text-muted-foreground/60",
          maturity.state === "growing" && "text-muted-foreground/70",
          maturity.state === "saving" && "text-muted-foreground/80",
          maturity.state === "ready" && "text-milestone-gold/80",
        )}
        aria-label="Toggle added date display"
      >
        {showAddedDate ? addedText : maturity.label}
      </button>
    </div>
  )
}
