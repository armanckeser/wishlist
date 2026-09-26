import { Command, Star, X } from "lucide-react"
import { useState } from "react"

import { FloatingLayer } from "@/components/Common/FloatingLayer"
import { Button } from "@/components/ui/button"
import { useMostDesiredOptional } from "@/contexts/MostDesiredContext"
import { useSelection } from "@/contexts/SelectionContext"

import { BulkActionsCommand } from "./BulkActionsCommand"
import { SelectAllButton } from "./SelectAllButton"

/**
 * FAB that appears in selection mode.
 * Shows select all, exit button, command button with count,
 * and star button when exactly 1 item is selected.
 */
export function SelectionFAB() {
  const { selectedCount, selectedIds, exitSelectionMode } = useSelection()
  const mostDesiredContext = useMostDesiredOptional()
  const [commandOpen, setCommandOpen] = useState(false)

  // Get the single selected item ID (only when exactly 1 selected)
  const singleSelectedId =
    selectedCount === 1 ? Array.from(selectedIds)[0] : null

  // Check if the single selected item is already the most desired
  const isAlreadyMostDesired =
    singleSelectedId &&
    mostDesiredContext?.mostDesiredItem?.id === singleSelectedId

  const handleToggleMostDesired = () => {
    if (singleSelectedId && mostDesiredContext) {
      mostDesiredContext.toggleMostDesired(singleSelectedId)
      exitSelectionMode()
    }
  }

  return (
    <>
      <FloatingLayer>
        {/* Star button - when 1 item selected (toggle on/off most desired) */}
        {singleSelectedId && mostDesiredContext && (
          <Button
            variant="secondary"
            size="lg"
            className={
              isAlreadyMostDesired
                ? "h-14 w-14 rounded-lg bg-amber-500/20 shadow-lg hover:bg-amber-500/10"
                : "h-14 w-14 rounded-lg bg-amber-500/10 shadow-lg hover:bg-amber-500/20"
            }
            onClick={handleToggleMostDesired}
            disabled={mostDesiredContext.isToggling}
          >
            <Star
              className={
                isAlreadyMostDesired
                  ? "h-6 w-6 fill-amber-500 text-amber-500"
                  : "h-6 w-6 text-amber-500"
              }
              strokeWidth={1.5}
            />
            <span className="sr-only">
              {isAlreadyMostDesired
                ? "Remove most desired"
                : "Set as most desired"}
            </span>
          </Button>
        )}

        <div className="flex items-center gap-2">
          {/* Select all filtered items */}
          <SelectAllButton />

          {/* Exit selection mode button */}
          <Button
            variant="secondary"
            size="lg"
            className="h-14 w-14 rounded-lg shadow-lg"
            onClick={exitSelectionMode}
          >
            <X className="h-6 w-6" strokeWidth={2} />
            <span className="sr-only">Exit selection mode</span>
          </Button>

          {/* Command button with count badge */}
          <Button
            size="lg"
            className="relative h-14 min-w-14 gap-2 rounded-lg px-4 shadow-lg transition-shadow hover:shadow-xl"
            onClick={() => setCommandOpen(true)}
            disabled={selectedCount === 0}
          >
            <Command className="h-6 w-6" strokeWidth={1.5} />
            {selectedCount > 0 && (
              <span className="font-medium">{selectedCount}</span>
            )}
            <span className="sr-only">
              Actions for {selectedCount} selected items
            </span>
          </Button>
        </div>
      </FloatingLayer>

      <BulkActionsCommand open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  )
}
