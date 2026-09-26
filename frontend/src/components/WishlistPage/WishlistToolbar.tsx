import { useFilter } from "@/components/Wishlist"
import type { ViewMode } from "@/hooks/useViewMode"

import { FilterButton } from "./FilterButton"
import { ItemCount } from "./ItemCount"
import { SearchInput } from "./SearchInput"
import { ViewModeToggle } from "./ViewModeToggle"

interface WishlistToolbarProps {
  filteredCount: number
  activeFilterCount: number
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenFilters: () => void
  hideViewToggle?: boolean
}

/**
 * Toolbar for the wishlist section.
 * Contains filter button, search input, item count, and view mode toggle.
 */
export function WishlistToolbar({
  filteredCount,
  activeFilterCount,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  hideViewToggle,
}: WishlistToolbarProps) {
  const { viewState, updateSearchQuery } = useFilter()

  return (
    <div className="flex items-center gap-3">
      <FilterButton activeCount={activeFilterCount} onClick={onOpenFilters} />

      <SearchInput value={viewState.searchQuery} onChange={updateSearchQuery} />

      <div className="flex shrink-0 items-center gap-4">
        <ItemCount
          filteredCount={filteredCount}
          activeFilterCount={activeFilterCount}
        />
        {!hideViewToggle && (
          <ViewModeToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        )}
      </div>
    </div>
  )
}
