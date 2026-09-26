import { cn } from "@/lib/utils"
import { getCategoryColor } from "./CategoryBadge"

interface CategorySuggestion {
  id: string
  name: string
}

interface SuggestionPillsProps {
  /** Categories to suggest */
  suggestions: CategorySuggestion[]
  /** Currently selected category IDs (to filter out) */
  selectedIds: string[]
  /** Callback when a suggestion is selected */
  onSelect: (id: string) => void
  /** Maximum number of pills to show */
  maxPills?: number
  /** Additional className */
  className?: string
}

/**
 * Tappable suggestion pills for quick category selection.
 * Shows dashed border to distinguish from selected badges.
 * Tap to instantly add a category without opening the picker.
 */
export function SuggestionPills({
  suggestions,
  selectedIds,
  onSelect,
  maxPills = 5,
  className,
}: SuggestionPillsProps) {
  // Filter out already-selected categories
  const selectedSet = new Set(selectedIds)
  const availableSuggestions = suggestions
    .filter((s) => !selectedSet.has(s.id))
    .slice(0, maxPills)

  if (availableSuggestions.length === 0) {
    return null
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {availableSuggestions.map((suggestion) => {
        const color = getCategoryColor(suggestion.name)
        return (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onSelect(suggestion.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border-2 border-dashed px-2.5 text-sm",
              "border-muted-foreground/40 text-muted-foreground",
              "transition-colors hover:border-foreground/60 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {/* Color dot */}
            <span
              className="h-2 w-2 shrink-0 rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
            {/* Category name */}
            <span>{suggestion.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export type { CategorySuggestion, SuggestionPillsProps }
