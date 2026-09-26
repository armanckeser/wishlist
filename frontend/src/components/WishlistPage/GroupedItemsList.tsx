import { type GroupedItems, WishlistGrid } from "@/components/Wishlist"
import { WishlistItem } from "@/components/WishlistItem"
import type { ViewMode } from "@/hooks/useViewMode"
import type { WishlistItemPublic } from "@/types"

import { GroupHeader } from "./GroupHeader"
import { NoFilterResults } from "./NoFilterResults"

interface GroupedItemsListProps {
  groupedItems: GroupedItems
  viewMode: ViewMode
  onItemClick: (item: WishlistItemPublic) => void
}

/**
 * Renders grouped wishlist items in either grid or list view.
 * Shows empty state when no items match filters.
 */
export function GroupedItemsList({
  groupedItems,
  viewMode,
  onItemClick,
}: GroupedItemsListProps) {
  if (groupedItems.length === 0) {
    return <NoFilterResults />
  }

  return (
    <div className="space-y-8">
      {groupedItems.map((group) => (
        <section key={group.groupId} className="space-y-4">
          <GroupHeader label={group.label} itemCount={group.items.length} />

          {viewMode === "grid" && (
            <WishlistGrid gap={16} minColumnWidth={160}>
              {group.items.map((item) => (
                <WishlistItem.Card
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </WishlistGrid>
          )}

          {viewMode === "list" && (
            <div className="space-y-1">
              {group.items.map((item) => (
                <WishlistItem.Row
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
