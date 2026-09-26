/**
 * Formatting helpers shared by the price tracking UI.
 *
 * Money goes through the same helper the item price uses, so a price never
 * reads as "$120" on the card and "$119.99" on the graph.
 */

import { formatPrice } from "@/components/Wishlist/utils"

/** "$120" - or "$12k" when compact (axis labels). */
export function formatCents(
  cents: number,
  { compact = false }: { compact?: boolean } = {},
): string {
  if (compact && Math.abs(cents) >= 1_000_000) {
    const thousands = cents / 100_000
    return `$${thousands.toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
  }
  return `$${formatPrice(cents)}`
}

/** "Sep 3" or "Sep 3, 2025" when not this year. */
export function formatShortDate(input: number | string | Date): string {
  const date = new Date(input)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

/** "just now" / "3h ago" / "2d ago" - short enough for a section header. */
export function formatRelativeShort(input: number | string | Date): string {
  const diffMs = Date.now() - new Date(input).getTime()
  if (!Number.isFinite(diffMs)) return ""
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatShortDate(input)
}

/** Signed percentage change, rounded: -12 / +8. */
export function percentChange(fromCents: number, toCents: number): number {
  if (fromCents <= 0) return 0
  return Math.round(((toCents - fromCents) / fromCents) * 100)
}
