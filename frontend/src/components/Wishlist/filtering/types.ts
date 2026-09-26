/**
 * Filter Registry Type System
 *
 * Defines the shape of filter dimensions in a fully declarative way.
 * Each filter dimension is self-contained with its options, matcher, grouper, and UI.
 */

import type { ReactNode } from "react"

import type { MaturityState } from "@/contexts/CooloffContext"
import type { BudgetInfo } from "@/hooks/useBudget"
import type { WishlistItemPublic } from "@/types"

// =============================================================================
// FILTER VALUE TYPES
// =============================================================================

/**
 * Three-state filter: neutral (any), include, or exclude specific values.
 */
export type ThreeStateFilter<T extends string = string> =
  | { mode: "any" }
  | { mode: "include"; values: T[] }
  | { mode: "exclude"; values: T[] }

/**
 * Range filter for numeric values.
 */
export type RangeFilter = { min?: number; max?: number }

/**
 * Union of all filter value types.
 */
export type FilterValue = ThreeStateFilter | RangeFilter

// =============================================================================
// OPTION TYPES
// =============================================================================

/**
 * A selectable option in a filter dimension.
 */
export interface FilterOption<TMeta = unknown> {
  value: string
  label: string
  meta?: TMeta
}

/**
 * Static options - defined inline.
 */
interface StaticOptionsConfig<TMeta = unknown> {
  source: "static"
  values: FilterOption<TMeta>[]
}

/**
 * Item-derived options - computed from wishlist items.
 */
interface ItemOptionsConfig<TMeta = unknown> {
  source: "items"
  derive: (items: WishlistItemPublic[]) => FilterOption<TMeta>[]
}

/**
 * Query-based options - fetched from API.
 */
interface QueryOptionsConfig<TMeta = unknown> {
  source: "query"
  queryKey: readonly string[]
  queryFn: () => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (data: any) => FilterOption<TMeta>[]
}

export type OptionsConfig<TMeta = unknown> =
  | StaticOptionsConfig<TMeta>
  | ItemOptionsConfig<TMeta>
  | QueryOptionsConfig<TMeta>

// =============================================================================
// FILTER CONTEXT (data available during matching)
// =============================================================================

export interface FilterContext {
  budgetInfo?: BudgetInfo | null
  getMaturityState: (item: WishlistItemPublic) => MaturityState
}

// =============================================================================
// GROUP BY TYPES
// =============================================================================

export interface ItemGroup {
  groupId: string
  label: string
  items: WishlistItemPublic[]
}

/** Array of groups for display */
export type GroupedItems = ItemGroup[]

export interface GroupByConfig {
  enabled: true
  grouper: (items: WishlistItemPublic[], context: FilterContext) => ItemGroup[]
}

// =============================================================================
// FILTER DIMENSION TYPES
// =============================================================================

/**
 * Base properties shared by all filter dimensions.
 */
interface FilterDimensionBase<TValue extends FilterValue> {
  id: string
  label: string
  urlParam: string

  /** Default value for this filter */
  defaultValue: TValue

  /** Matcher function - returns true if item passes filter */
  match: (
    item: WishlistItemPublic,
    value: TValue,
    context: FilterContext,
  ) => boolean

  /** URL serialization */
  serialize: (value: TValue) => string | undefined
  parse: (param: string | undefined) => TValue

  /** Optional: custom render for options in filter UI */
  renderOption?: (option: FilterOption) => ReactNode

  /** Optional: enable as group-by option */
  groupBy?: GroupByConfig
}

/**
 * Three-state filter dimension (include/exclude).
 */
export interface ThreeStateFilterDimension<TMeta = unknown>
  extends FilterDimensionBase<ThreeStateFilter> {
  type: "three-state"
  options: OptionsConfig<TMeta>
}

/**
 * Range filter dimension (min/max).
 */
export interface RangeFilterDimension
  extends Omit<FilterDimensionBase<RangeFilter>, "urlParam"> {
  type: "range"
  urlParamMin: string
  urlParamMax: string
}

/**
 * Union of all filter dimension types.
 */
export type FilterDimension = ThreeStateFilterDimension | RangeFilterDimension

// =============================================================================
// SORT TYPES
// =============================================================================

export type SortOption =
  | "date-newest"
  | "date-oldest"
  | "price-high"
  | "price-low"
  | "name-asc"
  | "name-desc"

export interface SortDefinition {
  value: SortOption
  label: string
  category: string
  compare: (a: WishlistItemPublic, b: WishlistItemPublic) => number
}

// =============================================================================
// VIEW STATE
// =============================================================================

/**
 * Complete view state for the wishlist.
 * Generic over the registry to derive filter keys.
 */
export interface WishlistViewState<TFilterKeys extends string = string> {
  sort: SortOption
  groupBy: TFilterKeys | "none"
  filters: Record<TFilterKeys, FilterValue>
}

// =============================================================================
// REGISTRY TYPE
// =============================================================================

/**
 * The filter registry - a record of filter dimensions.
 */
export type FilterRegistry = Record<string, FilterDimension>
