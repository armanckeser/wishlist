/**
 * Builder functions for creating filter dimensions.
 *
 * These provide a clean API for defining filters with proper defaults
 * for URL serialization and common patterns.
 */

import type { WishlistItemPublic } from "@/types"

import type {
  FilterContext,
  FilterOption,
  GroupByConfig,
  OptionsConfig,
  RangeFilter,
  RangeFilterDimension,
  ThreeStateFilter,
  ThreeStateFilterDimension,
} from "./types"

// =============================================================================
// URL SERIALIZATION HELPERS
// =============================================================================

function parseThreeStateParam(param: string | undefined): ThreeStateFilter {
  if (param === undefined) return { mode: "any" }
  // Explicit "any" marker - used when default is not "any"
  if (param === "*") return { mode: "any" }
  if (!param) return { mode: "any" }

  const values = param.split(",").filter(Boolean)
  if (values.length === 0) return { mode: "any" }

  const included: string[] = []
  const excluded: string[] = []

  for (const v of values) {
    if (v.startsWith("-")) {
      excluded.push(v.slice(1))
    } else if (v.startsWith("+")) {
      included.push(v.slice(1))
    } else {
      included.push(v)
    }
  }

  if (included.length > 0) {
    return { mode: "include", values: included }
  }
  if (excluded.length > 0) {
    return { mode: "exclude", values: excluded }
  }
  return { mode: "any" }
}

function serializeThreeStateParam(
  filter: ThreeStateFilter,
): string | undefined {
  // Return "*" for explicit "any" mode (caller decides when to use it)
  if (filter.mode === "any") return "*"
  if (filter.values.length === 0) return "*"
  const prefix = filter.mode === "include" ? "+" : "-"
  return filter.values.map((v) => `${prefix}${v}`).join(",")
}

// =============================================================================
// THREE-STATE FILTER BUILDER
// =============================================================================

interface ThreeStateFilterConfig<TMeta = unknown> {
  id: string
  label: string
  urlParam: string
  options: OptionsConfig<TMeta>
  match: (
    item: WishlistItemPublic,
    filter: ThreeStateFilter,
    context: FilterContext,
  ) => boolean
  renderOption?: (option: FilterOption) => React.ReactNode
  groupBy?: Omit<GroupByConfig, "enabled">
  /** Custom default filter value. Defaults to { mode: "any" } if not specified. */
  defaultValue?: ThreeStateFilter
}

export function createThreeStateFilter<TMeta = unknown>(
  config: ThreeStateFilterConfig<TMeta>,
): ThreeStateFilterDimension<TMeta> {
  return {
    type: "three-state",
    id: config.id,
    label: config.label,
    urlParam: config.urlParam,
    options: config.options,
    defaultValue: config.defaultValue ?? { mode: "any" },
    match: config.match,
    serialize: serializeThreeStateParam,
    parse: parseThreeStateParam,
    renderOption: config.renderOption,
    groupBy: config.groupBy ? { enabled: true, ...config.groupBy } : undefined,
  }
}

// =============================================================================
// RANGE FILTER BUILDER
// =============================================================================

interface RangeFilterConfig {
  id: string
  label: string
  urlParamMin: string
  urlParamMax: string
  match: (
    item: WishlistItemPublic,
    filter: RangeFilter,
    context: FilterContext,
  ) => boolean
}

export function createRangeFilter(
  config: RangeFilterConfig,
): RangeFilterDimension {
  return {
    type: "range",
    id: config.id,
    label: config.label,
    urlParamMin: config.urlParamMin,
    urlParamMax: config.urlParamMax,
    defaultValue: {},
    match: config.match,
    serialize: (value: RangeFilter) => {
      // Range filters use separate params, this is for consistency
      if (value.min === undefined && value.max === undefined) return undefined
      return JSON.stringify(value)
    },
    parse: () => ({}), // Range uses separate min/max params
  }
}

// =============================================================================
// COMMON MATCHER HELPERS
// =============================================================================

/**
 * Helper for matching three-state filters against a single value.
 */
export function matchThreeState(
  itemValue: string | null | undefined,
  filter: ThreeStateFilter,
): boolean {
  if (filter.mode === "any") return true
  if (!itemValue) return filter.mode === "exclude"
  if (filter.mode === "include") return filter.values.includes(itemValue)
  if (filter.mode === "exclude") return !filter.values.includes(itemValue)
  return true
}

/**
 * Helper for matching three-state filters against an array of values.
 * Returns true if ANY of the item's values match the include filter,
 * or NONE of the item's values match the exclude filter.
 */
export function matchThreeStateArray(
  itemValues: string[],
  filter: ThreeStateFilter,
): boolean {
  if (filter.mode === "any") return true
  if (itemValues.length === 0) return filter.mode === "exclude"
  if (filter.mode === "include") {
    return itemValues.some((v) => filter.values.includes(v))
  }
  if (filter.mode === "exclude") {
    return !itemValues.some((v) => filter.values.includes(v))
  }
  return true
}
