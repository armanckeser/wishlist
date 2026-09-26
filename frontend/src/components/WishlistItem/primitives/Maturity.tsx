import { MaturityProgress } from "@/components/Wishlist/MaturityProgress"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"
import { formatTimeUntilReady } from "../utils"

interface MaturityProps {
  className?: string
  /** Layout variant for different contexts */
  variant?: "inline" | "full"
  /** Show progress bar */
  showProgress?: boolean
  /** Show state label */
  showLabel?: boolean
  /** Show time remaining */
  showTime?: boolean
}

/**
 * Maturity indicator display.
 * Shows progress bar, state label, and time remaining.
 * Does not render for purchased items.
 */
export function Maturity({
  className,
  variant = "inline",
  showProgress = true,
  showLabel = true,
  showTime = true,
}: MaturityProps) {
  const { maturity, isPurchased } = useWishlistItem()

  if (isPurchased) return null

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {/* Progress bar + time */}
        {(showProgress || showTime) && (
          <div className="flex items-center gap-2">
            {showProgress && (
              <MaturityProgress
                progress={maturity.progress}
                state={maturity.state}
                className="flex-1"
              />
            )}
            {showTime && (
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] tracking-wide",
                  maturity.state === "ready"
                    ? "text-milestone-gold"
                    : "text-muted-foreground",
                )}
              >
                {formatTimeUntilReady(maturity.daysUntilReady)}
              </span>
            )}
          </div>
        )}

        {/* State label */}
        {showLabel && (
          <p
            className={cn(
              "text-[9px] font-medium uppercase tracking-[0.15em]",
              maturity.state === "cooling" && "text-muted-foreground/60",
              maturity.state === "growing" && "text-muted-foreground/70",
              maturity.state === "saving" && "text-muted-foreground/80",
              maturity.state === "ready" && "text-milestone-gold/80",
            )}
          >
            {maturity.label}
          </p>
        )}
      </div>
    )
  }

  // Full variant - time + label on same line (for row layout)
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showTime && (
        <span
          className={cn(
            "text-xs",
            maturity.state === "ready"
              ? "text-milestone-gold"
              : "text-muted-foreground",
          )}
        >
          {formatTimeUntilReady(maturity.daysUntilReady)}
        </span>
      )}
      {showLabel && (
        <span
          className={cn(
            "text-[9px] font-medium uppercase tracking-wide",
            maturity.state === "cooling" && "text-muted-foreground/60",
            maturity.state === "growing" && "text-muted-foreground/70",
            maturity.state === "saving" && "text-muted-foreground/80",
            maturity.state === "ready" && "text-milestone-gold/80",
          )}
        >
          {maturity.label}
        </span>
      )}
    </div>
  )
}
