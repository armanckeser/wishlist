/**
 * Grouped wishlist display using TanStack Table.
 * Groups items by maturity state (cooling, growing, ready) and purchased status.
 * Uses headless table for logic while rendering custom card grid UI.
 */

import {
  type ColumnDef,
  type GroupingState,
  getCoreRowModel,
  getGroupedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { LayoutGrid, List } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { WishlistItem } from "@/components/WishlistItem"
import { useCooloff } from "@/contexts/CooloffContext"
import { useViewMode } from "@/hooks/useViewMode"
import { cn } from "@/lib/utils"
import type { WishlistItemPublic } from "@/types"

import { createEmptyGroups, ITEM_GROUPS } from "./utils"
import { WishlistGrid } from "./WishlistGrid"

interface GroupedWishlistProps {
  items: WishlistItemPublic[]
  onItemClick: (item: WishlistItemPublic) => void
}

/**
 * Grouped wishlist with section headers for each maturity state.
 * Uses TanStack Table for grouping logic, ready for future sorting/filtering.
 */
export function GroupedWishlist({ items, onItemClick }: GroupedWishlistProps) {
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useViewMode()

  // Grouping state - group by computed "group" column
  const [grouping] = useState<GroupingState>(["group"])

  // Get cooloff calculations from context
  const { getItemGroup } = useCooloff()

  // Define columns - we only need the grouping column for now
  const columns = useMemo<ColumnDef<WishlistItemPublic>[]>(
    () => [
      {
        id: "group",
        // Accessor function computes the group for each item
        accessorFn: (item) => getItemGroup(item),
        header: "Group",
      },
    ],
    [getItemGroup],
  )

  // Set up TanStack Table with grouping (infrastructure for future sorting/filtering)
  useReactTable({
    data: items,
    columns,
    state: { grouping },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    // Don't need these for now but ready for future
    // getSortedRowModel: getSortedRowModel(),
    // getFilteredRowModel: getFilteredRowModel(),
  })
  const itemsByGroup = useMemo(() => {
    const groups = createEmptyGroups<WishlistItemPublic>()

    for (const item of items) {
      const group = getItemGroup(item)
      groups[group].push(item)
    }

    return groups
  }, [items, getItemGroup])

  // Only show groups that have items
  const activeGroups = ITEM_GROUPS.filter(
    (group) => itemsByGroup[group.id].length > 0,
  )

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* View toggle header */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "grid" && "bg-background shadow-sm",
            )}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "h-7 w-7 p-0",
              viewMode === "list" && "bg-background shadow-sm",
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grouped items */}
      <div className="space-y-8">
        {activeGroups.map((group) => (
          <section key={group.id} className="space-y-4">
            {/* Section header */}
            <div className="space-y-1">
              <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {group.label}
              </h2>
              <p className="text-xs text-muted-foreground/70">
                {itemsByGroup[group.id].length} item
                {itemsByGroup[group.id].length !== 1 && "s"}
              </p>
            </div>

            {/* Grid view */}
            {viewMode === "grid" && (
              <WishlistGrid gap={16} minColumnWidth={160}>
                {itemsByGroup[group.id].map((item) => (
                  <WishlistItem.Card
                    key={item.id}
                    item={item}
                    onClick={() => onItemClick(item)}
                  />
                ))}
              </WishlistGrid>
            )}

            {/* List view */}
            {viewMode === "list" && (
              <div className="space-y-1">
                {itemsByGroup[group.id].map((item) => (
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
    </div>
  )
}
