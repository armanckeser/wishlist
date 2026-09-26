import { CheckSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFilter } from "@/components/Wishlist"
import { useSelection } from "@/contexts/SelectionContext"

/**
 * Button that appears left of FAB during selection mode.
 * Selects all currently filtered/visible items.
 */
export function SelectAllButton() {
  const { selectAll, selectedCount } = useSelection()
  const { filteredItems } = useFilter()

  const allSelected =
    selectedCount === filteredItems.length && filteredItems.length > 0
  const label = allSelected
    ? "All Selected"
    : `Select All (${filteredItems.length})`

  return (
    <Button
      variant="secondary"
      size="lg"
      className="h-14 gap-2 rounded-lg px-4 shadow-lg"
      onClick={() => selectAll(filteredItems)}
      disabled={filteredItems.length === 0}
    >
      <CheckSquare className="h-5 w-5" strokeWidth={1.5} />
      <span className="font-medium">{label}</span>
    </Button>
  )
}
