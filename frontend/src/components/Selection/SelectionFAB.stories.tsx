import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckSquare, Command, Star, X } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { useSelection } from "@/contexts/SelectionContext"
import { createWishlistDecorator } from "@/storybook"

/**
 * Simplified SelectionFAB for Storybook.
 * The real SelectionFAB uses BulkActionsCommand which requires TanStack Router,
 * so we render a mock version that shows the UI without router dependencies.
 */
function SelectionFABMock({ selectedCount }: { selectedCount: number }) {
  const singleSelected = selectedCount === 1

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Star button - when 1 item selected */}
      {singleSelected && (
        <Button
          variant="secondary"
          size="lg"
          className="h-14 w-14 rounded-lg bg-amber-500/10 shadow-lg hover:bg-amber-500/20"
        >
          <Star className="h-6 w-6 text-amber-500" strokeWidth={1.5} />
          <span className="sr-only">Set as most desired</span>
        </Button>
      )}

      <div className="flex items-center gap-2">
        {/* Select all button */}
        <Button
          variant="secondary"
          size="lg"
          className="h-14 gap-2 rounded-lg px-4 shadow-lg"
        >
          <CheckSquare className="h-5 w-5" strokeWidth={1.5} />
          <span className="font-medium">Select All (4)</span>
        </Button>

        {/* Exit selection mode button */}
        <Button
          variant="secondary"
          size="lg"
          className="h-14 w-14 rounded-lg shadow-lg"
        >
          <X className="h-6 w-6" strokeWidth={2} />
          <span className="sr-only">Exit selection mode</span>
        </Button>

        {/* Command button with count badge */}
        <Button
          size="lg"
          className="relative h-14 min-w-14 gap-2 rounded-lg px-4 shadow-lg transition-shadow hover:shadow-xl"
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
    </div>
  )
}

/**
 * Helper component that enters selection mode and selects items.
 */
function SelectionModeSimulator({
  selectedCount = 0,
}: {
  selectedCount?: number
}) {
  const { enterSelectionMode, toggleItem, isSelectionMode } = useSelection()

  useEffect(() => {
    if (!isSelectionMode && selectedCount > 0) {
      enterSelectionMode()
      for (let i = 0; i < selectedCount; i++) {
        toggleItem(`item-${i}`)
      }
    }
  }, [enterSelectionMode, toggleItem, isSelectionMode, selectedCount])

  return null
}

const meta: Meta = {
  title: "Components/Selection/SelectionFAB",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Floating action button that appears in selection mode. Shows select all, exit, command button with count, and star button for single selection.",
      },
      story: {
        inline: false,
        iframeHeight: 300,
      },
    },
  },
  decorators: [createWishlistDecorator()],
}

export default meta
type Story = StoryObj

/**
 * Default state with no items selected.
 * Shows the FAB in selection mode but command button is disabled.
 */
export const NoSelection: Story = {
  render: () => (
    <div className="relative h-64 bg-background">
      <SelectionModeSimulator selectedCount={0} />
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Enter selection mode to see FAB
      </div>
      <SelectionFABMock selectedCount={0} />
    </div>
  ),
}

/**
 * Single item selected - shows star button for most desired toggle.
 */
export const SingleSelection: Story = {
  render: () => (
    <div className="relative h-64 bg-background">
      <SelectionModeSimulator selectedCount={1} />
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        1 item selected
      </div>
      <SelectionFABMock selectedCount={1} />
    </div>
  ),
}

/**
 * Multiple items selected - no star button (only for single selection).
 */
export const MultipleSelection: Story = {
  render: () => (
    <div className="relative h-64 bg-background">
      <SelectionModeSimulator selectedCount={3} />
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        3 items selected
      </div>
      <SelectionFABMock selectedCount={3} />
    </div>
  ),
}

/**
 * Many items selected - shows count in command button.
 */
export const ManySelected: Story = {
  render: () => (
    <div className="relative h-64 bg-background">
      <SelectionModeSimulator selectedCount={12} />
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        12 items selected
      </div>
      <SelectionFABMock selectedCount={12} />
    </div>
  ),
}
