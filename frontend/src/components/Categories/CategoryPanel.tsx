import { Check, ChevronLeft, Plus, Search, X } from "lucide-react"
import { useDeferredValue, useId } from "react"

import type { CategoryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { getCategoryColor } from "./CategoryBadge"
import type { useCategorySelection } from "./CategoryCommandView"

type SelectionState = ReturnType<typeof useCategorySelection>

interface CategoryPanelProps {
  state: SelectionState
  onBack: () => void
}

/**
 * Native-feeling category picker, rendered as a drill-down pane (no modal).
 * Uses a plain <input> + <button> list — no cmdk context, no nested portal.
 *
 * Layout: sticky header (back button + search), scrollable list below.
 * The list is a single column of 48-pt-tall taps with a leading checkbox
 * indicator and a colored dot. "Create" appears as the first row when the
 * search has no exact match.
 */
export function CategoryPanel({ state, onBack }: CategoryPanelProps) {
  const {
    search,
    setSearch,
    isLoading,
    filteredCategories,
    recentCategories,
    recentCategoryIds,
    exactMatch,
    childrenByParent,
    toggleCategory,
    handleCreateCategory,
    isCreating,
    selectedIds,
  } = state

  const searchId = useId()
  // Defer filtering work so typing stays smooth on lower-end mobiles.
  const deferredSearch = useDeferredValue(search)
  const trimmedSearch = deferredSearch.trim()

  const renderItem = (category: CategoryPublic, depth = 0) => {
    const isSelected = selectedIds.includes(category.id)
    const children = childrenByParent.get(category.id) ?? []
    const color = getCategoryColor(category.name)

    return (
      <div key={category.id}>
        <button
          type="button"
          onClick={() => toggleCategory(category.id)}
          aria-pressed={isSelected}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left",
            "min-h-[48px] text-base",
            "active:bg-accent/60",
            depth > 0 && "pl-10",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/40",
            )}
            aria-hidden="true"
          >
            {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          </span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="flex-1 truncate">{category.name}</span>
        </button>
        {children.map((child) => renderItem(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      {/* Header — sticky, native-iOS-feeling: leading back affordance, title, action */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 -ml-1 gap-0.5 px-2 text-base font-normal text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Back</span>
        </Button>
        <div className="flex-1 text-center text-sm font-semibold">
          Categories
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 px-2 text-base font-semibold text-primary"
        >
          Done
        </Button>
      </div>

      {/* Search — native input, prevents iOS zoom via text-base (16px) */}
      <div className="border-b px-3 py-2">
        <label htmlFor={searchId} className="sr-only">
          Search categories
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search or create category"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint={trimmedSearch && !exactMatch ? "send" : "search"}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                if (trimmedSearch && !exactMatch) {
                  handleCreateCategory()
                }
              }
            }}
            className={cn(
              "h-10 w-full rounded-md border bg-secondary/40 pl-9 pr-9",
              "text-base outline-none placeholder:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            {trimmedSearch && !exactMatch && (
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isCreating}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left",
                  "min-h-[48px] text-base",
                  "border-b",
                  "active:bg-accent/60 disabled:opacity-50",
                )}
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="truncate">
                  Create &ldquo;{trimmedSearch}&rdquo;
                  {isCreating && "…"}
                </span>
              </button>
            )}

            {!trimmedSearch && recentCategories.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent
                </div>
                {recentCategories.map((category) => renderItem(category))}
                <div className="my-1 h-px bg-border" />
              </>
            )}

            {filteredCategories.length === 0 && !trimmedSearch && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No categories yet. Type a name above to create one.
              </div>
            )}

            {filteredCategories.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {trimmedSearch ? "Matching" : "All"}
                </div>
                {filteredCategories
                  .filter(
                    (category) =>
                      trimmedSearch || !recentCategoryIds.has(category.id),
                  )
                  .map((category) => renderItem(category))}
              </>
            )}

            {trimmedSearch &&
              filteredCategories.length === 0 &&
              !exactMatch && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No matches. Tap &ldquo;Create&rdquo; above to add one.
                </div>
              )}
          </>
        )}

        {/* Bottom safe-area padding so the last row clears the home indicator */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  )
}
