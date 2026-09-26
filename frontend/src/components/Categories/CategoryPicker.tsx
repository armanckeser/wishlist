import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Plus } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { useRecentCategories } from "@/contexts/RecentCategoriesContext"
import { cn } from "@/lib/utils"
import {
  categoriesQueryOptions,
  categorySuggestionsQueryOptions,
} from "@/queries/categories"

import { CategoryBadge } from "./CategoryBadge"
import { SuggestionPills } from "./SuggestionPills"

/** Product metadata for category suggestions */
interface ProductMetadata {
  product_url?: string
  title?: string
  brand?: string
  breadcrumbs?: string[]
  category?: string
}

interface CategoryPickerProps {
  /** Currently selected category IDs */
  value: string[]
  /** Callback when selection changes (used here for suggestion pill taps) */
  onChange: (ids: string[]) => void
  /** Called when the user taps the trigger to drill into the picker */
  onOpen: () => void
  /** Optional className for the trigger button */
  className?: string
  /** Placeholder text when no categories selected */
  placeholder?: string
  /** Product metadata for backend suggestions */
  productMetadata?: ProductMetadata
}

/**
 * Trigger + selected badges + suggestion pills for category selection.
 *
 * The actual picker UI is rendered in a sibling drill-down pane managed by
 * the parent (ItemDialog). This component only owns the trigger; it does
 * NOT render any modal or popover.
 */
export function CategoryPicker({
  value,
  onChange,
  onOpen,
  className,
  placeholder = "Add categories",
  productMetadata,
}: CategoryPickerProps) {
  const { recentIds } = useRecentCategories()

  const { data: categoriesResponse } = useQuery(categoriesQueryOptions())
  const allCategories = categoriesResponse?.data ?? []

  const { data: backendSuggestions } = useQuery(
    categorySuggestionsQueryOptions({
      product_url: productMetadata?.product_url,
      title: productMetadata?.title,
      brand: productMetadata?.brand,
      breadcrumbs: productMetadata?.breadcrumbs,
      category: productMetadata?.category,
    }),
  )

  const selectedCategories = allCategories.filter((category) =>
    value.includes(category.id),
  )

  const suggestions = useMemo(() => {
    const categoryById = new Map(allCategories.map((c) => [c.id, c]))
    const seen = new Set<string>()
    const result: Array<{ id: string; name: string }> = []

    const confidenceThreshold = 0.5
    const backendList = backendSuggestions?.suggestions ?? []
    for (const suggestion of backendList) {
      if (
        suggestion.confidence >= confidenceThreshold &&
        !seen.has(suggestion.category_id)
      ) {
        seen.add(suggestion.category_id)
        result.push({
          id: suggestion.category_id,
          name: suggestion.category_name,
        })
      }
    }

    const maxSuggestions = 3
    const recentToAdd = Math.max(1, maxSuggestions - result.length)
    for (const id of recentIds.slice(0, recentToAdd)) {
      if (!seen.has(id)) {
        const cat = categoryById.get(id)
        if (cat) {
          seen.add(id)
          result.push({ id: cat.id, name: cat.name })
        }
      }
    }

    return result.slice(0, maxSuggestions)
  }, [recentIds, allCategories, backendSuggestions])

  const removeCategory = (categoryId: string) => {
    onChange(value.filter((id) => id !== categoryId))
  }

  const addCategory = (categoryId: string) => {
    if (!value.includes(categoryId)) {
      onChange([...value, categoryId])
    }
  }

  const triggerLabel =
    selectedCategories.length === 0
      ? placeholder
      : `${selectedCategories.length} selected`

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        className="h-11 justify-between gap-2 px-3 text-base font-normal"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span
            className={cn(
              selectedCategories.length === 0 && "text-muted-foreground",
            )}
          >
            {triggerLabel}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      {(selectedCategories.length > 0 || suggestions.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCategories.map((category) => (
            <CategoryBadge
              key={category.id}
              name={category.name}
              onRemove={() => removeCategory(category.id)}
              size="sm"
            />
          ))}
          <SuggestionPills
            suggestions={suggestions}
            selectedIds={value}
            onSelect={addCategory}
            maxPills={3}
          />
        </div>
      )}
    </div>
  )
}

export type { CategoryPickerProps }
