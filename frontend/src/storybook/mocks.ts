/**
 * Mock data for Storybook stories.
 * Provides realistic data for component previews without requiring API calls.
 */

import type { CategoryPublic, PriceTrackingPublic } from "@/client"
import type { CooloffSettings } from "@/contexts/CooloffContext"
import type { BudgetInfo } from "@/hooks/useBudget"
import type { WishlistItemPublic } from "@/types"

// Re-export BudgetInfo for convenience
export type { BudgetInfo } from "@/hooks/useBudget"

// =============================================================================
// Mock Item Factory
// =============================================================================

interface CreateMockItemOptions {
  title?: string
  description?: string | null
  priceCents?: number
  imageUrl?: string | null
  productUrl?: string | null
  status?: "wishlisted" | "purchased" | "archived" | "gifted"
  categories?: CategoryPublic[]
  isMostDesired?: boolean
  daysAgo?: number
  // For purchased items
  actualPricePaidCents?: number | null
  trackingUrl?: string | null
  // For gifted items
  giftMessage?: string | null
  gifterDisplayName?: string | null
  // For wishlisted items with automatic price tracking
  priceTracking?: Partial<PriceTrackingPublic>
}

/**
 * Creates a mock wishlist item with sensible defaults.
 * Customize with overrides for specific story scenarios.
 */
export function createMockItem(
  options: CreateMockItemOptions = {},
): WishlistItemPublic {
  const {
    title = "Mock Item",
    description = null,
    priceCents = 18500,
    imageUrl = null,
    productUrl = null,
    status = "wishlisted",
    categories = [],
    isMostDesired = false,
    daysAgo = 7,
    actualPricePaidCents,
    trackingUrl,
    giftMessage,
    gifterDisplayName,
    priceTracking,
  } = options

  const addedAt = new Date()
  addedAt.setDate(addedAt.getDate() - daysAgo)

  const baseItem = {
    id: crypto.randomUUID(),
    owner_id: "mock-owner",
    title,
    description,
    price_cents: priceCents,
    image_url: imageUrl,
    product_url: productUrl,
    added_at: addedAt.toISOString(),
    categories,
    is_most_desired: isMostDesired,
  }

  if (status === "purchased") {
    return {
      ...baseItem,
      status: "purchased" as const,
      purchased_at: new Date().toISOString(),
      tracking_url: trackingUrl ?? null,
      actual_price_paid_cents: actualPricePaidCents ?? null,
    }
  }

  if (status === "gifted") {
    return {
      ...baseItem,
      status: "gifted" as const,
      gifted_at: new Date().toISOString(),
      bought_by_id: "mock-gifter-id",
      gift_message: giftMessage ?? null,
      gifter_display_name: gifterDisplayName ?? null,
      tracking_url: trackingUrl ?? null,
    }
  }

  if (status === "archived") {
    return {
      ...baseItem,
      status: "archived" as const,
      archived_at: new Date().toISOString(),
    }
  }

  return {
    ...baseItem,
    status: "wishlisted" as const,
    price_tracking: priceTracking
      ? {
          enabled: true,
          eligible: true,
          paused: false,
          consecutive_failures: 0,
          ...priceTracking,
        }
      : undefined,
  }
}

// =============================================================================
// Sample Mock Items
// =============================================================================

export const MOCK_ITEMS = {
  goldRing: createMockItem({
    title: "Gold Vermeil Ring",
    priceCents: 28500,
    imageUrl:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=500&fit=crop",
    productUrl: "https://www.mejuri.com/products/ring",
    daysAgo: 14,
    isMostDesired: true,
  }),

  silkDress: createMockItem({
    title: "Silk Dress",
    priceCents: 22000,
    imageUrl:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop",
    productUrl: "https://www.reformation.com/products/silk-dress",
    daysAgo: 5,
  }),

  designerBag: createMockItem({
    title: "Designer Bag",
    priceCents: 500000,
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
    productUrl: "https://www.net-a-porter.com/product/bag",
    daysAgo: 30,
  }),

  pearlEarrings: createMockItem({
    title: "Pearl Earrings",
    priceCents: 15000,
    imageUrl:
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
    productUrl: "https://www.bluemercury.com/products/earrings",
    daysAgo: 30,
  }),

  noImage: createMockItem({
    title: "Item Without Image",
    priceCents: 9900,
    daysAgo: 3,
  }),

  purchased: createMockItem({
    title: "Purchased Cashmere Sweater",
    priceCents: 35000,
    imageUrl:
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop",
    status: "purchased",
    daysAgo: 45,
  }),

  archived: createMockItem({
    title: "Archived Silk Scarf",
    priceCents: 12000,
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
    status: "archived",
    daysAgo: 20,
  }),

  /** Purchased with discount (paid less than list price) */
  purchasedWithDiscount: createMockItem({
    title: "Sale Find Boots",
    priceCents: 45000,
    actualPricePaidCents: 32000, // 29% off!
    imageUrl:
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop",
    productUrl: "https://www.net-a-porter.com/product/boots",
    status: "purchased",
    daysAgo: 30,
  }),

  /** Purchased at full price */
  purchasedFullPrice: createMockItem({
    title: "Full Price Jacket",
    priceCents: 28000,
    actualPricePaidCents: 28000,
    imageUrl:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop",
    status: "purchased",
    daysAgo: 14,
  }),

  /** Purchased at higher price (don't show original) */
  purchasedOverpaid: createMockItem({
    title: "Limited Edition Watch",
    priceCents: 120000,
    actualPricePaidCents: 145000, // Paid more (resale, etc.)
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=500&fit=crop",
    status: "purchased",
    daysAgo: 60,
  }),

  /** Gifted item with message */
  gifted: createMockItem({
    title: "Birthday Gift Bracelet",
    priceCents: 28500,
    imageUrl:
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
    productUrl: "https://www.mejuri.com/products/bracelet",
    status: "gifted",
    gifterDisplayName: "Troy Barnes",
    giftMessage: "Happy birthday! Hope you love it.",
    daysAgo: 21,
  }),

  /** Gifted item without message (anonymous) */
  giftedAnonymous: createMockItem({
    title: "Mystery Perfume",
    priceCents: 15000,
    imageUrl:
      "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=500&fit=crop",
    status: "gifted",
    daysAgo: 5,
  }),
} as const

/** Array of wishlisted items for grid displays */
export const MOCK_WISHLIST_ITEMS: WishlistItemPublic[] = [
  MOCK_ITEMS.goldRing,
  MOCK_ITEMS.silkDress,
  MOCK_ITEMS.designerBag,
  MOCK_ITEMS.pearlEarrings,
]

// =============================================================================
// Mock Cooloff Settings
// =============================================================================

export const MOCK_COOLOFF_SETTINGS: CooloffSettings = {
  cooloff_scaling_cents: null,
  cooloff_scaling_days: 3,
  cooloff_min_threshold_cents: 10000,
  cooloff_min_threshold_days: 7,
  cooloff_max_days: null,
  freeze_penalty_days: 7,
}

// =============================================================================
// Mock Budget Info
// =============================================================================

/**
 * Creates a mock BudgetInfo object for stories.
 * @param currentCents - Current budget in cents (default: $500)
 * @param monthlyRateCents - Monthly rate in cents (default: $600/month)
 */
export function createMockBudgetInfo(
  currentCents = 50000,
  monthlyRateCents = 60000,
): BudgetInfo {
  const ratePerDay = monthlyRateCents / 30

  return {
    currentCents,
    monthlyRateCents,
    isAffordable: (priceCents: number) => currentCents >= priceCents,
    getTimeUntilAffordable: (priceCents: number) => {
      if (currentCents >= priceCents) return null
      const centsNeeded = priceCents - currentCents
      const days = centsNeeded / ratePerDay
      if (days < 1) return "in a few hours"
      if (days < 7) return `in ${Math.ceil(days)} days`
      if (days < 30) return `in ${Math.ceil(days / 7)} weeks`
      return `in ${Math.ceil(days / 30)} months`
    },
    getDaysUntilAffordable: (priceCents: number) => {
      if (currentCents >= priceCents) return 0
      if (monthlyRateCents <= 0) return Infinity
      const centsNeeded = priceCents - currentCents
      return centsNeeded / ratePerDay
    },
    cooloffSettings: MOCK_COOLOFF_SETTINGS,
  }
}

export const MOCK_BUDGET_INFO = createMockBudgetInfo()

/** Budget info where user has very low balance */
export const MOCK_BUDGET_INFO_LOW = createMockBudgetInfo(5000, 60000)

/** Budget info where user has high balance (most items affordable) */
export const MOCK_BUDGET_INFO_HIGH = createMockBudgetInfo(1000000, 60000)

/** Budget info with frozen budget (rate = 0) */
export const MOCK_BUDGET_INFO_FROZEN = createMockBudgetInfo(17100, 0)

/** Budget info in debt (negative balance) */
export const MOCK_BUDGET_INFO_NEGATIVE = createMockBudgetInfo(-15000, 60000)
