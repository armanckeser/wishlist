/**
 * Filter Registry - SINGLE SOURCE OF TRUTH
 *
 * All filter dimensions are defined here. To add a new filter:
 * 1. Add an entry to FILTER_REGISTRY
 * 2. That's it. No other files to touch.
 */

import { getCategoryColor } from "@/components/Categories/CategoryBadge"
import type { WishlistItemPublic } from "@/types"

import { extractBrandFromUrl } from "../utils"
import {
  createRangeFilter,
  createThreeStateFilter,
  matchThreeState,
  matchThreeStateArray,
} from "./builders"
import type {
  FilterContext,
  FilterRegistry,
  ItemGroup,
  SortDefinition,
  ThreeStateFilter,
} from "./types"

// =============================================================================
// GROUPER HELPERS
// =============================================================================

function groupByMaturity(
  items: WishlistItemPublic[],
  context: FilterContext,
): ItemGroup[] {
  const groups: Record<string, WishlistItemPublic[]> = {
    cooling: [],
    growing: [],
    saving: [],
    ready: [],
    purchased: [],
    gifted: [],
    archived: [],
  }

  const labels: Record<string, string> = {
    cooling: "Cooling Off",
    growing: "Growing On You",
    saving: "Saving Up",
    ready: "Ready to Treat",
    purchased: "Purchased",
    gifted: "Gifted",
    archived: "Archived",
  }

  const order = [
    "cooling",
    "growing",
    "saving",
    "ready",
    "purchased",
    "gifted",
    "archived",
  ]

  for (const item of items) {
    if (item.status === "purchased") {
      groups.purchased.push(item)
    } else if (item.status === "gifted") {
      groups.gifted.push(item)
    } else if (item.status === "archived") {
      groups.archived.push(item)
    } else {
      const state = context.getMaturityState(item)
      groups[state].push(item)
    }
  }

  return order
    .filter((id) => groups[id].length > 0)
    .map((id) => ({
      groupId: id,
      label: labels[id],
      items: groups[id],
    }))
}

function groupByBrand(items: WishlistItemPublic[]): ItemGroup[] {
  const groups = new Map<string, WishlistItemPublic[]>()
  const unknown: WishlistItemPublic[] = []

  for (const item of items) {
    const brand = extractBrandFromUrl(item.product_url)
    if (brand) {
      const existing = groups.get(brand) ?? []
      existing.push(item)
      groups.set(brand, existing)
    } else {
      unknown.push(item)
    }
  }

  const sortedBrands = Array.from(groups.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  const result: ItemGroup[] = sortedBrands.map((brand) => ({
    groupId: brand,
    label: brand,
    items: groups.get(brand) ?? [],
  }))

  if (unknown.length > 0) {
    result.push({ groupId: "unknown", label: "Unknown", items: unknown })
  }

  return result
}

function groupByCategory(items: WishlistItemPublic[]): ItemGroup[] {
  const groups = new Map<string, WishlistItemPublic[]>()
  const uncategorized: WishlistItemPublic[] = []

  for (const item of items) {
    const categories = item.categories ?? []
    if (categories.length === 0) {
      uncategorized.push(item)
    } else {
      const firstCategory = categories[0].name
      const existing = groups.get(firstCategory) ?? []
      existing.push(item)
      groups.set(firstCategory, existing)
    }
  }

  const sortedCategories = Array.from(groups.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  const result: ItemGroup[] = sortedCategories.map((category) => ({
    groupId: category,
    label: category,
    items: groups.get(category) ?? [],
  }))

  if (uncategorized.length > 0) {
    result.push({
      groupId: "uncategorized",
      label: "Uncategorized",
      items: uncategorized,
    })
  }

  return result
}

// =============================================================================
// FILTER REGISTRY
// =============================================================================

export const FILTER_REGISTRY = {
  maturity: createThreeStateFilter({
    id: "maturity",
    label: "Progress",
    urlParam: "progress",
    options: {
      source: "static",
      values: [
        { value: "cooling", label: "Cooling Off" },
        { value: "growing", label: "Growing On You" },
        { value: "saving", label: "Saving Up" },
        { value: "ready", label: "Ready to Treat" },
      ],
    },
    match: (item, filter, context) => {
      // Purchased, gifted, and archived items don't have maturity, let them pass through
      if (
        item.status === "purchased" ||
        item.status === "gifted" ||
        item.status === "archived"
      )
        return true
      const maturity = context.getMaturityState(item)
      return matchThreeState(maturity, filter)
    },
    groupBy: {
      grouper: groupByMaturity,
    },
  }),

  status: createThreeStateFilter({
    id: "status",
    label: "Status",
    urlParam: "status",
    options: {
      source: "static",
      values: [
        { value: "wishlisted", label: "Wishlisted" },
        { value: "purchased", label: "Purchased" },
        { value: "gifted", label: "Gifted" },
        { value: "tracking", label: "Tracking" },
        { value: "archived", label: "Archived" },
      ],
    },
    // Default to excluding archived and tracking items - they're hidden unless explicitly requested
    defaultValue: { mode: "exclude", values: ["archived", "tracking"] },
    match: (item, filter) => matchThreeState(item.status, filter),
  }),

  deliveryStatus: createThreeStateFilter({
    id: "deliveryStatus",
    label: "Delivery Status",
    urlParam: "delivery",
    options: {
      source: "static",
      values: [
        { value: "pending", label: "Pending Sync" },
        { value: "in_transit", label: "In Transit" },
        { value: "out_for_delivery", label: "Out for Delivery" },
        { value: "delivered", label: "Delivered" },
        { value: "exception", label: "Exception" },
      ],
    },
    defaultValue: { mode: "any" },
    match: (item, filter) => {
      // Only apply to items with tracking (use 'in' check for type safety)
      if (!("tracking_number" in item) || !item.tracking_number) return true

      // Map tracking_status to our filter values
      const status = "tracking_status" in item ? item.tracking_status : null
      if (!status) return matchThreeState("pending", filter)

      // Normalize status values
      const normalizedStatus =
        status === "not_found" || status === "info_received"
          ? "pending"
          : status

      return matchThreeState(normalizedStatus, filter)
    },
  }),

  brand: createThreeStateFilter({
    id: "brand",
    label: "Brand",
    urlParam: "brand",
    options: {
      source: "items",
      derive: (items) => {
        const brands = new Set<string>()
        for (const item of items) {
          const brand = extractBrandFromUrl(item.product_url)
          if (brand) brands.add(brand)
        }
        return Array.from(brands)
          .sort()
          .map((b) => ({ value: b, label: b }))
      },
    },
    match: (item, filter) => {
      const brand = extractBrandFromUrl(item.product_url)
      return matchThreeState(brand, filter)
    },
    groupBy: {
      grouper: groupByBrand,
    },
  }),

  category: createThreeStateFilter<{ color: string }>({
    id: "category",
    label: "Category",
    urlParam: "category",
    options: {
      source: "items",
      derive: (items) => {
        const categories = new Map<string, string>()
        for (const item of items) {
          for (const category of item.categories ?? []) {
            if (!categories.has(category.name)) {
              categories.set(category.name, getCategoryColor(category.name))
            }
          }
        }
        return [
          {
            value: "__uncategorized__",
            label: "Uncategorized",
            meta: { color: "#9ca3af" },
          },
          ...Array.from(categories.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, color]) => ({
              value: name,
              label: name,
              meta: { color },
            })),
        ]
      },
    },
    match: (item, filter) => {
      const itemCategories = item.categories?.map((c) => c.name) ?? []

      // Handle "Uncategorized" filter specially
      if (
        filter.mode === "include" &&
        filter.values.includes("__uncategorized__")
      ) {
        // If including uncategorized, match items with no categories
        // OR items matching other included values
        const otherValues = filter.values.filter(
          (v) => v !== "__uncategorized__",
        )
        if (itemCategories.length === 0) return true
        if (otherValues.length > 0) {
          return itemCategories.some((v) => otherValues.includes(v))
        }
        return false
      }
      if (
        filter.mode === "exclude" &&
        filter.values.includes("__uncategorized__")
      ) {
        // If excluding uncategorized, exclude items with no categories
        const otherValues = filter.values.filter(
          (v) => v !== "__uncategorized__",
        )
        if (itemCategories.length === 0) return false
        if (otherValues.length > 0) {
          return !itemCategories.some((v) => otherValues.includes(v))
        }
        return true
      }

      return matchThreeStateArray(itemCategories, filter)
    },
    renderOption: (option) => {
      const meta = option.meta as { color: string } | undefined
      return (
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: meta?.color }}
          />
          {option.label}
        </span>
      )
    },
    groupBy: {
      grouper: groupByCategory,
    },
  }),

  price: createRangeFilter({
    id: "price",
    label: "Price Range",
    urlParamMin: "priceMin",
    urlParamMax: "priceMax",
    match: (item, filter) => {
      const priceDollars = item.price_cents / 100
      if (filter.min !== undefined && priceDollars < filter.min) return false
      if (filter.max !== undefined && priceDollars > filter.max) return false
      return true
    },
  }),
} as const satisfies FilterRegistry

export type FilterDimensionId = keyof typeof FILTER_REGISTRY

// =============================================================================
// PAGE DEFAULTS (Single Source of Truth for page-specific filter states)
// =============================================================================

export type PageDefault = "wishlist" | "purchased" | "archived" | "tracking"

export const PAGE_DEFAULTS: Record<
  PageDefault,
  Partial<Record<FilterDimensionId, ThreeStateFilter>>
> = {
  wishlist: { status: { mode: "include", values: ["wishlisted"] } },
  purchased: { status: { mode: "include", values: ["purchased", "gifted"] } },
  archived: { status: { mode: "include", values: ["archived"] } },
  tracking: {
    status: { mode: "include", values: ["tracking", "purchased", "gifted"] },
  },
}

// =============================================================================
// SORT DEFINITIONS
// =============================================================================

export const SORT_DEFINITIONS: SortDefinition[] = [
  {
    value: "date-newest",
    label: "Newest first",
    category: "Date Added",
    compare: (a, b) =>
      new Date(b.added_at).getTime() - new Date(a.added_at).getTime(),
  },
  {
    value: "date-oldest",
    label: "Oldest first",
    category: "Date Added",
    compare: (a, b) =>
      new Date(a.added_at).getTime() - new Date(b.added_at).getTime(),
  },
  {
    value: "price-high",
    label: "Highest first",
    category: "Price",
    compare: (a, b) => b.price_cents - a.price_cents,
  },
  {
    value: "price-low",
    label: "Lowest first",
    category: "Price",
    compare: (a, b) => a.price_cents - b.price_cents,
  },
  {
    value: "name-asc",
    label: "A to Z",
    category: "Name",
    compare: (a, b) => a.title.localeCompare(b.title),
  },
  {
    value: "name-desc",
    label: "Z to A",
    category: "Name",
    compare: (a, b) => b.title.localeCompare(a.title),
  },
]

// =============================================================================
// GROUP BY OPTIONS (derived from registry)
// =============================================================================

export const GROUP_BY_OPTIONS = [
  ...Object.values(FILTER_REGISTRY)
    .filter((dim) => dim.groupBy?.enabled)
    .map((dim) => ({ value: dim.id, label: dim.label })),
  { value: "none", label: "None" },
] as const

// =============================================================================
// DEFAULT VIEW STATE (derived from registry)
// =============================================================================

export const DEFAULT_SORT = "date-newest" as const
export const DEFAULT_GROUP_BY = "maturity" as const

export function getDefaultViewState(pageDefault?: PageDefault) {
  const filters: Record<
    string,
    ThreeStateFilter | { min?: number; max?: number }
  > = {}

  for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
    // Use page-specific default if available, otherwise use dimension default
    const pageOverride =
      pageDefault && PAGE_DEFAULTS[pageDefault]?.[id as FilterDimensionId]
    filters[id] = pageOverride ?? dim.defaultValue
  }

  return {
    sort: DEFAULT_SORT,
    groupBy: DEFAULT_GROUP_BY,
    filters,
    searchQuery: "",
    pageDefault,
  }
}
