import type { BudgetPublic } from "@/client"

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/**
 * Calculates the current budget in cents based on stored value and accrued time.
 */
export function calculateCurrentCents(budget: BudgetPublic): number {
  const timestamp = budget.last_updated_at.endsWith("Z")
    ? budget.last_updated_at
    : `${budget.last_updated_at}Z`
  const lastUpdatedAt = new Date(timestamp).getTime()

  const monthlyRateCents = budget.monthly_rate_cents ?? 0
  const baseCents = budget.cents_at_last_update ?? 0

  const elapsedMs = Date.now() - lastUpdatedAt
  const centsPerMs = monthlyRateCents / (SECONDS_PER_MONTH * 1000)

  return baseCents + elapsedMs * centsPerMs
}

/**
 * Formats cents to a display string (e.g., 123456 -> "$1,234.56").
 */
export function formatCentsToDisplay(cents: number): string {
  const dollars = cents / 100
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formats cents to dollars for input fields (e.g., 123456 -> "1234.56").
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}

/**
 * Converts dollars to cents (e.g., 1234.56 -> 123456).
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}
