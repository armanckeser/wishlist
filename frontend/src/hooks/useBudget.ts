import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { BudgetService } from "@/client"

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Calculates the cents accrued per millisecond from a monthly rate.
 */
function centsPerMs(monthlyRateCents: number): number {
  return monthlyRateCents / (SECONDS_PER_MONTH * 1000)
}

/**
 * Formats days until affordable as relative time string.
 */
function formatDaysUntilAffordable(days: number): string {
  if (days < 1) {
    const hours = Math.ceil(days * 24)
    return hours === 1 ? "in 1 hour" : `in ${hours} hours`
  }
  if (days < 7) {
    const roundedDays = Math.ceil(days)
    return roundedDays === 1 ? "in 1 day" : `in ${roundedDays} days`
  }
  if (days < 30) {
    const weeks = Math.ceil(days / 7)
    return weeks === 1 ? "in 1 week" : `in ${weeks} weeks`
  }
  const months = Math.ceil(days / 30)
  return months === 1 ? "in 1 month" : `in ${months} months`
}

export interface CooloffSettings {
  cooloff_scaling_cents?: number | null
  cooloff_scaling_days?: number
  cooloff_min_threshold_cents?: number | null
  cooloff_min_threshold_days?: number
  cooloff_max_days?: number | null
  freeze_penalty_days?: number
}

export interface BudgetInfo {
  /** Current budget in cents (snapshot, not live-updating) */
  currentCents: number
  /** Monthly rate in cents */
  monthlyRateCents: number
  /** Check if an item is affordable */
  isAffordable: (priceCents: number) => boolean
  /** Get relative time until item is affordable, or null if already affordable */
  getTimeUntilAffordable: (priceCents: number) => string | null
  /** Get days until item is affordable, or 0 if already affordable. Returns Infinity if rate is 0. */
  getDaysUntilAffordable: (priceCents: number) => number
  /** Cool-off settings for maturity calculations */
  cooloffSettings: CooloffSettings
}

/**
 * Hook that provides budget information for affordability calculations.
 * Uses a snapshot of current budget (not live-updating) for efficiency.
 * Refreshes every 60 seconds.
 */
export function useBudget(): BudgetInfo | null {
  const { data: budget } = useQuery({
    queryKey: ["budget"],
    queryFn: () => BudgetService.getBudget(),
    refetchInterval: 60000,
  })

  return useMemo(() => {
    if (!budget) return null

    // Calculate current budget snapshot
    const timestamp = budget.last_updated_at.endsWith("Z")
      ? budget.last_updated_at
      : `${budget.last_updated_at}Z`
    const lastUpdatedAt = new Date(timestamp).getTime()
    const rate = centsPerMs(budget.monthly_rate_cents ?? 0)
    const baseCents = budget.cents_at_last_update ?? 0
    const elapsedMs = Date.now() - lastUpdatedAt
    const currentCents = baseCents + elapsedMs * rate

    const isAffordable = (priceCents: number): boolean => {
      return currentCents >= priceCents
    }

    const getTimeUntilAffordable = (priceCents: number): string | null => {
      if (currentCents >= priceCents) return null

      const centsNeeded = priceCents - currentCents
      if (rate <= 0) return null

      const msUntilAffordable = centsNeeded / rate
      const daysUntilAffordable = msUntilAffordable / MS_PER_DAY

      return formatDaysUntilAffordable(daysUntilAffordable)
    }

    const getDaysUntilAffordable = (priceCents: number): number => {
      if (currentCents >= priceCents) return 0

      const centsNeeded = priceCents - currentCents
      if (rate <= 0) return Infinity

      const msUntilAffordable = centsNeeded / rate
      return msUntilAffordable / MS_PER_DAY
    }

    return {
      currentCents,
      monthlyRateCents: budget.monthly_rate_cents ?? 0,
      isAffordable,
      getTimeUntilAffordable,
      getDaysUntilAffordable,
      cooloffSettings: {
        cooloff_scaling_cents: budget.cooloff_scaling_cents,
        cooloff_scaling_days: budget.cooloff_scaling_days,
        cooloff_min_threshold_cents: budget.cooloff_min_threshold_cents,
        cooloff_min_threshold_days: budget.cooloff_min_threshold_days,
        cooloff_max_days: budget.cooloff_max_days,
        freeze_penalty_days: budget.freeze_penalty_days,
      },
    }
  }, [budget])
}
