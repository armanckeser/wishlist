/**
 * Shared utilities for wishlist item display.
 *
 * NOTE: Cooloff calculations have moved to CooloffContext.
 * This file contains only pure formatting/display utilities.
 */

import humanizeDuration from "humanize-duration"

import type { ItemGroup } from "@/contexts/CooloffContext"

/**
 * Humanizer configured for short, elegant time display.
 */
const shortHumanizer = humanizeDuration.humanizer({
  language: "shortEn",
  languages: {
    shortEn: {
      y: () => "y",
      mo: () => "mo",
      w: () => "w",
      d: () => "d",
      h: () => "h",
      m: () => "m",
      s: () => "s",
      ms: () => "ms",
    },
  },
  spacer: "",
  round: true,
  largest: 1,
})

/**
 * Group display info for section headers.
 */
export interface GroupInfo {
  id: ItemGroup
  label: string
  description: string
}

/**
 * All possible groups in display order.
 */
export const ITEM_GROUPS: GroupInfo[] = [
  {
    id: "cooling",
    label: "Cooling Off",
    description: "New items in cool-off period",
  },
  {
    id: "growing",
    label: "Growing On You",
    description: "Building patience",
  },
  {
    id: "saving",
    label: "Saving Up",
    description: "Matured, waiting on budget",
  },
  {
    id: "ready",
    label: "Ready to Treat",
    description: "Ready to purchase",
  },
  { id: "purchased", label: "Purchased", description: "Items you've bought" },
]

/**
 * Creates an empty groups object with all group IDs initialized to empty arrays.
 * Use this instead of manually listing groups to maintain single source of truth.
 */
export function createEmptyGroups<T>(): Record<ItemGroup, T[]> {
  const groups = {} as Record<ItemGroup, T[]>
  for (const group of ITEM_GROUPS) {
    groups[group.id] = []
  }
  return groups
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Format relative time elegantly (past tense for "X days ago").
 */
export function formatRelativeTime(days: number): string {
  if (days === 0) return "today"
  return shortHumanizer(days * MS_PER_DAY)
}

/**
 * Format time until ready (future tense for countdown).
 * Returns "Ready!" when days <= 0.
 * Shows minutes when < 1 hour remaining (e.g., "15m left").
 * Shows hours when < 1 day remaining (e.g., "5h left").
 * Shows days for longer periods (e.g., "3d left").
 */
export function formatTimeUntilReady(days: number): string {
  if (days <= 0) return "Ready!"

  const hours = days * 24

  // When less than 1 hour, show minutes
  if (hours < 1) {
    const minutes = Math.max(1, Math.ceil(hours * 60))
    return `${minutes}m left`
  }

  // When less than 1 day, show hours
  if (days < 1) {
    return `${Math.max(1, Math.ceil(hours))}h left`
  }

  // For 1+ days, show whole days
  return `${shortHumanizer(Math.ceil(days) * MS_PER_DAY)} left`
}

/**
 * Format cents to display price.
 */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Extract brand name from product URL.
 * "https://www.mejuri.com/products/ring" → "Mejuri"
 * "https://net-a-porter.com/product/123" → "Net-a-Porter"
 */
export function extractBrandFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null

  try {
    const hostname = new URL(url).hostname
    // Remove www. prefix and .com/.co.uk/etc suffix
    const domain = hostname
      .replace(/^www\./, "")
      .replace(/\.(com|co\.uk|net|org|io|shop|store)$/, "")

    // Capitalize first letter of each word, handle hyphens
    return domain
      .split(/[-.]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  } catch {
    return null
  }
}
