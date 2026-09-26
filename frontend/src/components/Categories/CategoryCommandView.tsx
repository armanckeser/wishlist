import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { CategoryPublic } from "@/client"
import { CategoriesService } from "@/client"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useRecentCategories } from "@/contexts/RecentCategoriesContext"
import { cn } from "@/lib/utils"
import { categoriesQueryOptions } from "@/queries/categories"
import { getCategoryColor } from "./CategoryBadge"

interface UseCategorySelectionProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

/**
 * Hook that provides all the logic for category selection.
 * Returns state and handlers for use with CategoryCommandContent.
 */
export function useCategorySelection({
  selectedIds,
  onSelectionChange,
}: UseCategorySelectionProps) {
  const [search, setSearch] = useState("")
  const queryClient = useQueryClient()
  const { recentIds, addRecent, cleanupStaleIds } = useRecentCategories()

  const { data: categoriesResponse, isLoading } = useQuery(
    categoriesQueryOptions(),
  )
  const categories = categoriesResponse?.data ?? []

  // Track categories selected during this session (for adding to recent on unmount)
  const selectedDuringSessionRef = useRef<Set<string>>(new Set())

  // Clean up stale IDs when categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      const validIds = new Set(categories.map((c) => c.id))
      cleanupStaleIds(validIds)
    }
  }, [categories, cleanupStaleIds])

  // Add selected categories to recent when component unmounts
  useEffect(() => {
    return () => {
      for (const id of selectedDuringSessionRef.current) {
        addRecent(id)
      }
    }
  }, [addRecent])

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      CategoriesService.createNewCategory({ requestBody: { name } }),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      onSelectionChange([...selectedIds, newCategory.id])
      setSearch("")
    },
  })

  // Build hierarchy: group categories by parent
  const { topLevel, childrenByParent } = useMemo(() => {
    const childrenByParent = new Map<string, CategoryPublic[]>()
    const topLevel: CategoryPublic[] = []

    for (const category of categories) {
      if (category.parent_id) {
        const children = childrenByParent.get(category.parent_id) ?? []
        children.push(category)
        childrenByParent.set(category.parent_id, children)
      } else {
        topLevel.push(category)
      }
    }

    return { topLevel, childrenByParent }
  }, [categories])

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return topLevel

    const searchLower = search.toLowerCase()
    return categories.filter((category) =>
      category.name.toLowerCase().includes(searchLower),
    )
  }, [search, topLevel, categories])

  // Check if search matches any existing category
  const exactMatch = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    return categories.some(
      (category) => category.name.toLowerCase() === searchLower,
    )
  }, [search, categories])

  // Get recent categories (filtered to only valid ones)
  const recentCategories = useMemo(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]))
    return recentIds
      .map((id) => categoryById.get(id))
      .filter((c): c is CategoryPublic => c !== undefined)
      .slice(0, 3)
  }, [recentIds, categories])

  // Set of recent category IDs for filtering
  const recentCategoryIds = useMemo(
    () => new Set(recentCategories.map((c) => c.id)),
    [recentCategories],
  )

  const toggleCategory = useCallback(
    (categoryId: string) => {
      if (selectedIds.includes(categoryId)) {
        onSelectionChange(selectedIds.filter((id) => id !== categoryId))
        selectedDuringSessionRef.current.delete(categoryId)
      } else {
        onSelectionChange([...selectedIds, categoryId])
        selectedDuringSessionRef.current.add(categoryId)
      }
    },
    [selectedIds, onSelectionChange],
  )

  const handleCreateCategory = useCallback(() => {
    const trimmedName = search.trim()
    if (trimmedName && !exactMatch) {
      createMutation.mutate(trimmedName)
    }
  }, [search, exactMatch, createMutation])

  return {
    search,
    setSearch,
    isLoading,
    categories,
    filteredCategories,
    recentCategories,
    recentCategoryIds,
    exactMatch,
    childrenByParent,
    toggleCategory,
    handleCreateCategory,
    isCreating: createMutation.isPending,
    selectedIds,
  }
}

type CategorySelectionState = ReturnType<typeof useCategorySelection>

interface CategoryCommandContentProps {
  state: CategorySelectionState
  onDone?: () => void
  showDoneButton?: boolean
}

/**
 * The content for category selection (CommandInput + CommandList).
 * Use inside Command or CommandDialog.
 */
export function CategoryCommandContent({
  state,
  onDone,
  showDoneButton = false,
}: CategoryCommandContentProps) {
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

  const renderCategoryItem = (category: CategoryPublic, depth = 0) => {
    const isSelected = selectedIds.includes(category.id)
    const children = childrenByParent.get(category.id) ?? []
    const color = getCategoryColor(category.name)

    return (
      <div key={category.id}>
        <CommandItem
          value={category.name}
          onSelect={() => toggleCategory(category.id)}
          className={cn(depth > 0 && "ml-4")}
        >
          <div
            className={cn(
              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
              isSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground",
            )}
          >
            {isSelected && <Check className="h-3 w-3" />}
          </div>
          <span
            className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span>{category.name}</span>
        </CommandItem>
        {children.map((child) => renderCategoryItem(child, depth + 1))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <>
        <CommandInput placeholder="Loading categories..." disabled />
        <CommandList>
          <CommandEmpty>Loading...</CommandEmpty>
        </CommandList>
      </>
    )
  }

  return (
    <>
      <CommandInput
        placeholder="Search or create category..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {filteredCategories.length === 0 && !search.trim() && (
          <CommandEmpty>No categories yet. Type to create one.</CommandEmpty>
        )}

        {search.trim() && !exactMatch && (
          <>
            <CommandGroup>
              <CommandItem
                onSelect={handleCreateCategory}
                disabled={isCreating}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>
                  Create &quot;{search.trim()}&quot;
                  {isCreating && " ..."}
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Recent section - only show when not searching and there are recent categories */}
        {!search.trim() && recentCategories.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentCategories.map((category) => renderCategoryItem(category))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {filteredCategories.length > 0 && (
          <CommandGroup heading={search.trim() ? "Matching" : "All Categories"}>
            {filteredCategories
              .filter(
                (category) =>
                  // When not searching, filter out categories already shown in Recent
                  search.trim() || !recentCategoryIds.has(category.id),
              )
              .map((category) => renderCategoryItem(category))}
          </CommandGroup>
        )}

        {showDoneButton && onDone && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={onDone} className="justify-center">
                <span className="font-medium">Done</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </>
  )
}

interface CategoryCommandViewProps {
  /** Currently selected category IDs */
  selectedIds: string[]
  /** Callback when selection changes */
  onSelectionChange: (ids: string[]) => void
  /** Optional callback when done selecting (for closing popover) */
  onDone?: () => void
  /** Whether to show the done button */
  showDoneButton?: boolean
}

/**
 * Complete command palette for selecting and creating categories.
 * Wraps CategoryCommandContent in a Command component.
 * Use this for Popover usage. For CommandDialog, use useCategorySelection + CategoryCommandContent.
 */
export function CategoryCommandView({
  selectedIds,
  onSelectionChange,
  onDone,
  showDoneButton = false,
}: CategoryCommandViewProps) {
  const state = useCategorySelection({ selectedIds, onSelectionChange })

  return (
    <Command shouldFilter={false}>
      <CategoryCommandContent
        state={state}
        onDone={onDone}
        showDoneButton={showDoneButton}
      />
    </Command>
  )
}
