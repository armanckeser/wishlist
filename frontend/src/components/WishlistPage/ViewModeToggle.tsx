import { LayoutGrid, List } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ViewMode } from "@/hooks/useViewMode"
import { cn } from "@/lib/utils"

interface ViewModeToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

/**
 * Toggle button group for switching between grid and list view.
 */
export function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange("grid")}
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
        onClick={() => onViewModeChange("list")}
        className={cn(
          "h-7 w-7 p-0",
          viewMode === "list" && "bg-background shadow-sm",
        )}
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  )
}
