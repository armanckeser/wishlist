/**
 * Filter Context - Central state management for filtering.
 *
 * Provides:
 * - View state (sort, groupBy, filters)
 * - Filtered and grouped items
 * - All options for each filter dimension
 * - Registry access for UI rendering
 */

import { useQueries } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react"

import { useBudgetInfo } from "@/contexts/BudgetInfoContext"
import { type MaturityState, useCooloff } from "@/contexts/CooloffContext"
import type { BudgetInfo } from "@/hooks/useBudget"
import type { WishlistItemPublic } from "@/types"

import { extractBrandFromUrl } from "../utils"
import {
  DEFAULT_GROUP_BY,
  DEFAULT_SORT,
  FILTER_REGISTRY,
  type FilterDimensionId,
  getDefaultViewState,
  PAGE_DEFAULTS,
  type PageDefault,
  SORT_DEFINITIONS,
} from "./registry"
import type {
  FilterContext as FilterContextType,
  FilterOption,
  FilterValue,
  GroupedItems,
  RangeFilter,
  SortOption,
  ThreeStateFilter,
} from "./types"

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if two ThreeStateFilters are equal.
 */
function isThreeStateEqual(a: ThreeStateFilter, b: ThreeStateFilter): boolean {
  if (a.mode !== b.mode) return false
  if (a.mode === "any" && b.mode === "any") return true
  // At this point, both must have same mode and both have values
  const aVals = "values" in a ? [...a.values].sort() : []
  const bVals = "values" in b ? [...b.values].sort() : []
  return aVals.length === bVals.length && aVals.every((v, i) => v === bVals[i])
}

// =============================================================================
// VIEW STATE TYPE
// =============================================================================

export interface ViewState {
  sort: SortOption
  groupBy: FilterDimensionId | "none"
  filters: Record<FilterDimensionId, FilterValue>
  searchQuery: string
  pageDefault?: PageDefault
}

// =============================================================================
// CONTEXT TYPE
// =============================================================================

interface FilterContextValue {
  // View state
  viewState: ViewState
  updateViewState: (state: ViewState) => void
  updateFilter: (dimensionId: FilterDimensionId, value: FilterValue) => void
  updateSearchQuery: (query: string) => void
  resetFilters: () => void

  // Derived data
  filteredItems: WishlistItemPublic[]
  groupedItems: GroupedItems
  totalCount: number
  filteredCount: number
  activeFilterCount: number

  // Options for each dimension (fetched/derived)
  dimensionOptions: Record<FilterDimensionId, FilterOption[]>

  // Registry access for UI
  registry: typeof FILTER_REGISTRY
  sortDefinitions: typeof SORT_DEFINITIONS
}

const FilterContext = createContext<FilterContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

interface FilterProviderProps {
  children: ReactNode
  items: WishlistItemPublic[]
  /** Optional - if not provided, uses BudgetInfoContext (must be inside BudgetInfoProvider) */
  budgetInfo?: BudgetInfo | null
  viewState: ViewState
  onViewStateChange: (state: ViewState) => void
}

export function FilterProvider({
  children,
  items,
  budgetInfo: budgetInfoProp,
  viewState,
  onViewStateChange,
}: FilterProviderProps) {
  const { getMaturityInfo } = useCooloff()
  // Use prop if provided, otherwise get from context
  const budgetInfoFromContext = useBudgetInfo()
  const budgetInfo = budgetInfoProp ?? budgetInfoFromContext

  // Helper to get maturity state for an item
  const getMaturityState = useCallback(
    (item: WishlistItemPublic): MaturityState =>
      getMaturityInfo(item, budgetInfo).state,
    [getMaturityInfo, budgetInfo],
  )

  const filterContext: FilterContextType = useMemo(
    () => ({ budgetInfo, getMaturityState }),
    [budgetInfo, getMaturityState],
  )

  // ==========================================================================
  // FETCH QUERY-BASED OPTIONS
  // ==========================================================================

  const queryDimensions = Object.entries(FILTER_REGISTRY).filter(
    ([, dim]) => dim.type === "three-state" && dim.options.source === "query",
  )

  const queryResults = useQueries({
    queries: queryDimensions.map(([, dim]) => {
      if (dim.type !== "three-state" || dim.options.source !== "query") {
        throw new Error("Invalid dimension for query")
      }
      return {
        queryKey: dim.options.queryKey,
        queryFn: dim.options.queryFn,
        select: dim.options.transform,
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    }),
  })

  // ==========================================================================
  // DERIVE ALL OPTIONS
  // ==========================================================================

  const dimensionOptions = useMemo(() => {
    const options: Record<string, FilterOption[]> = {}

    for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
      if (dim.type === "three-state") {
        switch (dim.options.source) {
          case "static":
            options[id] = dim.options.values
            break
          case "items":
            options[id] = dim.options.derive(items)
            break
          case "query": {
            const queryIndex = queryDimensions.findIndex(([qId]) => qId === id)
            options[id] = queryResults[queryIndex]?.data ?? []
            break
          }
        }
      } else {
        // Range filters don't have options
        options[id] = []
      }
    }

    return options as Record<FilterDimensionId, FilterOption[]>
  }, [items, queryResults, queryDimensions])

  // ==========================================================================
  // APPLY FILTERS
  // ==========================================================================

  const filteredItems = useMemo(() => {
    const searchLower = viewState.searchQuery.toLowerCase().trim()

    return items.filter((item) => {
      // Apply search filter first
      if (searchLower) {
        const matchesTitle = item.title.toLowerCase().includes(searchLower)
        const matchesBrand = extractBrandFromUrl(item.product_url)
          ?.toLowerCase()
          .includes(searchLower)
        const matchesCategory = item.categories?.some((c) =>
          c.name.toLowerCase().includes(searchLower),
        )
        if (!matchesTitle && !matchesBrand && !matchesCategory) {
          return false
        }
      }

      // Apply registry filters
      for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
        const filterValue = viewState.filters[id as FilterDimensionId]
        if (!dim.match(item, filterValue as never, filterContext)) {
          return false
        }
      }
      return true
    })
  }, [items, viewState.filters, viewState.searchQuery, filterContext])

  // ==========================================================================
  // APPLY SORTING
  // ==========================================================================

  const sortedItems = useMemo(() => {
    const sortDef = SORT_DEFINITIONS.find((s) => s.value === viewState.sort)
    if (!sortDef) return filteredItems
    return [...filteredItems].sort(sortDef.compare)
  }, [filteredItems, viewState.sort])

  // ==========================================================================
  // APPLY GROUPING
  // ==========================================================================

  const groupedItems = useMemo((): GroupedItems => {
    if (viewState.groupBy === "none") {
      return sortedItems.length > 0
        ? [{ groupId: "all", label: "All Items", items: sortedItems }]
        : []
    }

    const dim = FILTER_REGISTRY[viewState.groupBy as FilterDimensionId]
    if (!dim?.groupBy?.enabled) {
      return [{ groupId: "all", label: "All Items", items: sortedItems }]
    }

    return dim.groupBy.grouper(sortedItems, filterContext)
  }, [sortedItems, viewState.groupBy, filterContext])

  // ==========================================================================
  // COUNT ACTIVE FILTERS
  // ==========================================================================

  const activeFilterCount = useMemo(() => {
    let count = 0
    for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
      const value = viewState.filters[id as FilterDimensionId]
      if (dim.type === "three-state") {
        // Determine the effective default: page default takes precedence
        const pageOverride =
          viewState.pageDefault &&
          PAGE_DEFAULTS[viewState.pageDefault]?.[id as FilterDimensionId]
        const effectiveDefault = pageOverride ?? dim.defaultValue

        // Count as active if differs from effective default
        if (!isThreeStateEqual(value as ThreeStateFilter, effectiveDefault)) {
          count++
        }
      } else if (dim.type === "range") {
        const range = value as RangeFilter
        if (range.min !== undefined || range.max !== undefined) count++
      }
    }
    return count
  }, [viewState.filters, viewState.pageDefault])

  // ==========================================================================
  // UPDATE HELPERS
  // ==========================================================================

  const updateFilter = useCallback(
    (dimensionId: FilterDimensionId, value: FilterValue) => {
      onViewStateChange({
        ...viewState,
        filters: { ...viewState.filters, [dimensionId]: value },
      })
    },
    [viewState, onViewStateChange],
  )

  const updateSearchQuery = useCallback(
    (query: string) => {
      onViewStateChange({
        ...viewState,
        searchQuery: query,
      })
    },
    [viewState, onViewStateChange],
  )

  const resetFilters = useCallback(() => {
    onViewStateChange(getDefaultViewState(viewState.pageDefault) as ViewState)
  }, [onViewStateChange, viewState.pageDefault])

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: FilterContextValue = useMemo(
    () => ({
      viewState,
      updateViewState: onViewStateChange,
      updateFilter,
      updateSearchQuery,
      resetFilters,
      filteredItems: sortedItems,
      groupedItems,
      totalCount: items.length,
      filteredCount: sortedItems.length,
      activeFilterCount,
      dimensionOptions,
      registry: FILTER_REGISTRY,
      sortDefinitions: SORT_DEFINITIONS,
    }),
    [
      viewState,
      onViewStateChange,
      updateFilter,
      updateSearchQuery,
      resetFilters,
      sortedItems,
      groupedItems,
      items.length,
      activeFilterCount,
      dimensionOptions,
    ],
  )

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

export function useFilter(): FilterContextValue {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error("useFilter must be used within a FilterProvider")
  }
  return context
}

// =============================================================================
// URL STATE HELPERS
// =============================================================================

import { z } from "zod"

/**
 * Zod schema for URL search params.
 */
export const wishlistSearchSchema = z.object({
  item: z.string().optional(),
  sort: z
    .enum([
      "date-newest",
      "date-oldest",
      "price-high",
      "price-low",
      "name-asc",
      "name-desc",
    ])
    .optional(),
  group: z.string().optional(),
  search: z.string().optional(),
  // Page default - determines status filter when not explicitly set
  default: z.enum(["wishlist", "purchased", "archived", "tracking"]).optional(),
  // Three-state filters - all string params
  progress: z.string().optional(),
  status: z.string().optional(),
  brand: z.string().optional(),
  label: z.string().optional(),
  delivery: z.string().optional(),
  // Range
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
})

export type WishlistSearchParams = z.infer<typeof wishlistSearchSchema>

/**
 * Parse URL search params into ViewState.
 * Priority: explicit URL param > pageDefault > dimension default
 */
export function parseSearchParams(params: WishlistSearchParams): ViewState {
  const pageDefault = params.default as PageDefault | undefined
  const filters: Record<string, FilterValue> = {}

  for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
    if (dim.type === "three-state") {
      const urlParam = params[id as keyof WishlistSearchParams] as
        | string
        | undefined

      if (urlParam !== undefined) {
        // Explicit URL param takes precedence
        filters[id] = dim.parse(urlParam)
      } else if (
        pageDefault &&
        PAGE_DEFAULTS[pageDefault]?.[id as FilterDimensionId]
      ) {
        // Derive from page default
        filters[id] = PAGE_DEFAULTS[pageDefault][id as FilterDimensionId]!
      } else {
        // Fall back to dimension default
        filters[id] = dim.defaultValue
      }
    } else if (dim.type === "range") {
      filters[id] = {
        min: params.priceMin,
        max: params.priceMax,
      }
    }
  }

  return {
    sort: params.sort ?? DEFAULT_SORT,
    groupBy: (params.group as FilterDimensionId | "none") ?? DEFAULT_GROUP_BY,
    filters: filters as Record<FilterDimensionId, FilterValue>,
    searchQuery: params.search ?? "",
    pageDefault,
  }
}

/**
 * Serialize ViewState to URL params. Only includes non-default values.
 * When pageDefault is set, the derived status filter is not serialized (it's derived from default=).
 */
export function serializeViewState(
  state: ViewState,
  itemId?: string,
): WishlistSearchParams {
  const params: WishlistSearchParams = {}

  if (itemId) params.item = itemId
  if (state.pageDefault) params.default = state.pageDefault
  if (state.sort !== DEFAULT_SORT) params.sort = state.sort
  if (state.groupBy !== DEFAULT_GROUP_BY) params.group = state.groupBy
  if (state.searchQuery) params.search = state.searchQuery

  for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
    const value = state.filters[id as FilterDimensionId]

    if (dim.type === "three-state") {
      const filterValue = value as ThreeStateFilter

      // Determine the effective default: page default takes precedence
      const pageOverride =
        state.pageDefault &&
        PAGE_DEFAULTS[state.pageDefault]?.[id as FilterDimensionId]
      const effectiveDefault = pageOverride ?? dim.defaultValue

      // Skip if matches effective default (keeps URL clean)
      if (isThreeStateEqual(filterValue, effectiveDefault)) continue

      // Serialize always returns a value now (* for "any")
      const serialized = dim.serialize(filterValue)!
      ;(params as Record<string, string>)[id] = serialized
    } else if (dim.type === "range") {
      const range = value as RangeFilter
      if (range.min !== undefined) params.priceMin = range.min
      if (range.max !== undefined) params.priceMax = range.max
    }
  }

  return params
}

/**
 * Check if current state has any active filters (differs from effective defaults).
 * When pageDefault is set, the derived status filter is not counted as active.
 */
export function hasActiveFilters(state: ViewState): boolean {
  const hasNonDefaultSort = state.sort !== DEFAULT_SORT
  const hasNonDefaultGroup = state.groupBy !== DEFAULT_GROUP_BY

  for (const [id, dim] of Object.entries(FILTER_REGISTRY)) {
    const value = state.filters[id as FilterDimensionId]
    if (dim.type === "three-state") {
      // Determine the effective default: page default takes precedence
      const pageOverride =
        state.pageDefault &&
        PAGE_DEFAULTS[state.pageDefault]?.[id as FilterDimensionId]
      const effectiveDefault = pageOverride ?? dim.defaultValue

      // Check if filter differs from effective default
      if (!isThreeStateEqual(value as ThreeStateFilter, effectiveDefault)) {
        return true
      }
    }
    if (dim.type === "range") {
      const range = value as RangeFilter
      if (range.min !== undefined || range.max !== undefined) return true
    }
  }

  return hasNonDefaultSort || hasNonDefaultGroup
}
