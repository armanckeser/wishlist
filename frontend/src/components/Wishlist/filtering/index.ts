/**
 * Filtering Module - Public API
 *
 * This module provides a fully declarative filtering system.
 * To add a new filter, only modify registry.tsx.
 */

// Context and hooks
export {
  FilterProvider,
  hasActiveFilters,
  parseSearchParams,
  serializeViewState,
  useFilter,
  type ViewState,
  type ViewState as WishlistViewState, // Backwards compatibility alias
  type WishlistSearchParams,
  wishlistSearchSchema,
} from "./FilterContext"

// Registry
export {
  DEFAULT_GROUP_BY,
  DEFAULT_SORT,
  FILTER_REGISTRY,
  type FilterDimensionId,
  GROUP_BY_OPTIONS,
  getDefaultViewState,
  PAGE_DEFAULTS,
  type PageDefault,
  SORT_DEFINITIONS,
} from "./registry"

// Types
export type {
  FilterOption,
  FilterValue,
  GroupedItems,
  RangeFilter,
  SortOption,
  ThreeStateFilter,
} from "./types"
