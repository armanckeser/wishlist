import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { BudgetService } from "@/client"
import { cn } from "@/lib/utils"

import { useLiveBudget } from "./useLiveBudget"

/**
 * Format time remaining until a date.
 */
function formatTimeRemaining(until: Date): string {
  const now = new Date()
  const diffMs = until.getTime() - now.getTime()

  if (diffMs <= 0) return ""

  const diffSecs = Math.floor(diffMs / 1000)
  const days = Math.floor(diffSecs / 86400)
  const hours = Math.floor((diffSecs % 86400) / 3600)
  const minutes = Math.floor((diffSecs % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

type TickerSize = "sm" | "lg"

interface BudgetTickerProps {
  size?: TickerSize
  className?: string
}

/**
 * Live-updating budget ticker display.
 * Uses useLiveBudget for real-time state and 60fps DOM updates.
 */
export function BudgetTicker({ size = "lg", className }: BudgetTickerProps) {
  const [freezeRemaining, setFreezeRemaining] = useState<string>("")

  const { data: budget, refetch } = useQuery({
    queryKey: ["budget"],
    queryFn: () => BudgetService.getBudget(),
    refetchInterval: 60000,
  })

  const { state, displayRefs } = useLiveBudget({ budget })

  const freezeUntil = budget?.freeze_until
    ? new Date(
        budget.freeze_until.endsWith("Z")
          ? budget.freeze_until
          : `${budget.freeze_until}Z`,
      )
    : null

  // Update freeze countdown every minute
  useEffect(() => {
    if (!freezeUntil || !state.isFrozen) {
      setFreezeRemaining("")
      return
    }

    const updateCountdown = () => {
      const remaining = formatTimeRemaining(freezeUntil)
      setFreezeRemaining(remaining)
      if (!remaining) refetch()
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [freezeUntil, state.isFrozen, refetch])

  // Determine gradient: frozen (blue) > negative (red) > normal (none)
  const gradientClass = state.isFrozen
    ? "blue-gradient-text"
    : state.isNegative
      ? "red-gradient-text"
      : null

  if (size === "sm") {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className={cn("flex items-baseline", gradientClass)}>
          <span
            className={cn(
              "font-display text-sm font-light",
              !gradientClass && "text-muted-foreground",
            )}
          >
            {state.isNegative && "-"}$
          </span>
          <span
            ref={displayRefs.dollarsRef}
            className={cn(
              "font-display text-xl font-light tracking-tight tabular-nums",
              !gradientClass && "text-foreground",
            )}
          >
            0
          </span>
          <span
            ref={displayRefs.decimalRef}
            className={cn(
              "font-display text-sm font-light tabular-nums",
              !gradientClass && "text-muted-foreground",
            )}
          >
            .000000
          </span>
        </div>
        {state.isFrozen && freezeRemaining && (
          <span className="text-xs text-muted-foreground">
            Frozen for {freezeRemaining}
          </span>
        )}
      </div>
    )
  }

  // Full size version
  return (
    <div className={cn("relative flex flex-col", className)}>
      <div className={cn("flex items-baseline", gradientClass)}>
        <span
          className={cn(
            "font-display text-4xl font-light",
            !gradientClass && "text-muted-foreground",
          )}
        >
          {state.isNegative && "-"}$
        </span>
        <span
          ref={displayRefs.dollarsRef}
          className={cn(
            "font-display text-7xl md:text-8xl font-light tracking-tight tabular-nums",
            !gradientClass && "text-foreground",
          )}
        >
          0
        </span>
        <span
          ref={displayRefs.decimalRef}
          className={cn(
            "font-display text-4xl font-light tracking-tight tabular-nums",
            !gradientClass && "text-muted-foreground",
          )}
        >
          .000000
        </span>
      </div>
      {state.isFrozen && freezeRemaining && (
        <span className="mt-2 text-sm text-muted-foreground">
          Frozen for {freezeRemaining}
        </span>
      )}
    </div>
  )
}
