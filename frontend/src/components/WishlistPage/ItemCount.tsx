interface ItemCountProps {
  filteredCount: number
  activeFilterCount: number
}

/**
 * Displays the item count.
 * Only shows "X of Y" style when user has active filters (differs from defaults).
 * Default filter (exclude archived) doesn't trigger "X of Y" display.
 */
export function ItemCount({
  filteredCount,
  activeFilterCount,
}: ItemCountProps) {
  const hasActiveFilters = activeFilterCount > 0

  return (
    <span className="text-sm text-muted-foreground">
      {hasActiveFilters
        ? `${filteredCount} filtered`
        : `${filteredCount} items`}
    </span>
  )
}
