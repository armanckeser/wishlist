import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import {
  Archive,
  Check,
  ChevronLeft,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"

import type { CategoryPublic } from "@/client"
import { CategoriesService, WishlistService } from "@/client"
import { getCategoryColor } from "@/components/Categories/CategoryBadge"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useSelection } from "@/contexts/SelectionContext"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { categoriesQueryOptions } from "@/queries/categories"
import { handleError } from "@/utils"

import { BulkDeleteDialog } from "./BulkDeleteDialog"

interface BulkActionsCommandProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ViewMode = "actions" | "categories"

/**
 * Command palette for bulk actions on selected items.
 * Categories are searchable inline - type a category name to see it as a quick action.
 * Supports multi-select categories mode for setting multiple categories at once.
 */
export function BulkActionsCommand({
  open,
  onOpenChange,
}: BulkActionsCommandProps) {
  const { userId } = useParams({ from: "/_layout/$userId" })
  const { selectedIds, selectedCount, exitSelectionMode } = useSelection()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("actions")
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [search, setSearch] = useState("")

  // Fetch categories
  const { data: categoriesResponse } = useQuery(categoriesQueryOptions())
  const categories = categoriesResponse?.data ?? []

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const searchLower = search.toLowerCase()
    return categories.filter((category) =>
      category.name.toLowerCase().includes(searchLower),
    )
  }, [search, categories])

  // Check if search matches any existing category exactly
  const exactMatch = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    return categories.some(
      (category) => category.name.toLowerCase() === searchLower,
    )
  }, [search, categories])

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () =>
      WishlistService.bulkArchiveItemsEndpoint({
        requestBody: { item_ids: Array.from(selectedIds) },
      }),
    onSuccess: (data) => {
      showSuccessToast(`Archived ${data.archived_count} items`)
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
      exitSelectionMode()
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  // Set single category mutation (quick action)
  const setSingleCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      WishlistService.bulkSetCategoriesEndpoint({
        requestBody: {
          item_ids: Array.from(selectedIds),
          category_ids: [categoryId],
        },
      }),
    onSuccess: (data) => {
      showSuccessToast(`Set category on ${data.updated_count} items`)
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
      exitSelectionMode()
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  // Set multiple categories mutation
  const setMultipleCategoriesMutation = useMutation({
    mutationFn: () =>
      WishlistService.bulkSetCategoriesEndpoint({
        requestBody: {
          item_ids: Array.from(selectedIds),
          category_ids: selectedCategoryIds,
        },
      }),
    onSuccess: (data) => {
      const message =
        selectedCategoryIds.length === 0
          ? `Cleared categories from ${data.updated_count} items`
          : `Set categories on ${data.updated_count} items`
      showSuccessToast(message)
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
      exitSelectionMode()
      onOpenChange(false)
      setSelectedCategoryIds([])
      setViewMode("actions")
    },
    onError: handleError.bind(showErrorToast),
  })

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (name: string) =>
      CategoriesService.createNewCategory({ requestBody: { name } }),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      // In multi-select mode, add to selection; in actions mode, apply directly
      if (viewMode === "categories") {
        setSelectedCategoryIds((prev) => [...prev, newCategory.id])
      } else {
        setSingleCategoryMutation.mutate(newCategory.id)
      }
      setSearch("")
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleDelete = () => {
    onOpenChange(false)
    setTimeout(() => setDeleteDialogOpen(true), 250)
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    )
  }

  const handleClose = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      // Reset state when closing
      setViewMode("actions")
      setSelectedCategoryIds([])
      setSearch("")
    }
  }

  const renderCategoryItem = (
    category: CategoryPublic,
    mode: "quick" | "multi",
  ) => {
    const color = getCategoryColor(category.name)
    const isSelected = selectedCategoryIds.includes(category.id)

    if (mode === "quick") {
      return (
        <CommandItem
          key={category.id}
          value={`set-category-${category.name}`}
          onSelect={() => setSingleCategoryMutation.mutate(category.id)}
          disabled={setSingleCategoryMutation.isPending}
        >
          <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Set Category →</span>
          <span
            className="mx-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span>{category.name}</span>
        </CommandItem>
      )
    }

    return (
      <CommandItem
        key={category.id}
        value={category.name}
        onSelect={() => toggleCategory(category.id)}
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
    )
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={handleClose}
        title="Bulk Actions"
        description={`Actions for ${selectedCount} selected items`}
      >
        <CommandInput
          placeholder={
            viewMode === "categories"
              ? "Search categories..."
              : "Search actions or categories..."
          }
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {viewMode === "actions" ? (
            <>
              <CommandEmpty>No actions or categories found.</CommandEmpty>

              {/* Quick category actions - show when searching or always show top categories */}
              {filteredCategories.length > 0 && (
                <CommandGroup heading="Set Category">
                  {(search.trim()
                    ? filteredCategories
                    : filteredCategories.slice(0, 5)
                  ).map((category) => renderCategoryItem(category, "quick"))}
                  {!search.trim() && filteredCategories.length > 5 && (
                    <CommandItem
                      value="view-all-categories"
                      onSelect={() => setViewMode("categories")}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      <span>
                        View all categories ({filteredCategories.length})
                      </span>
                    </CommandItem>
                  )}
                </CommandGroup>
              )}

              {/* Create new category option */}
              {search.trim() && !exactMatch && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={`create-category-${search}`}
                      onSelect={() =>
                        createCategoryMutation.mutate(search.trim())
                      }
                      disabled={createCategoryMutation.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span>
                        Create &amp; set &quot;{search.trim()}&quot;
                        {createCategoryMutation.isPending && " ..."}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />

              {/* Actions */}
              <CommandGroup
                heading={`${selectedCount} item${selectedCount !== 1 ? "s" : ""} selected`}
              >
                <CommandItem
                  value="set-multiple-categories"
                  onSelect={() => setViewMode("categories")}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span>Set Multiple Categories...</span>
                </CommandItem>
                <CommandItem
                  value="archive"
                  onSelect={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  <span>Archive{archiveMutation.isPending && "..."}</span>
                </CommandItem>
                <CommandItem
                  value="delete"
                  onSelect={handleDelete}
                  className="text-destructive data-[selected=true]:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : (
            <>
              {/* Multi-select categories mode */}
              <CommandEmpty>No categories found.</CommandEmpty>

              {/* Back button */}
              <CommandGroup>
                <CommandItem
                  value="back"
                  onSelect={() => setViewMode("actions")}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  <span>Back to actions</span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              {/* Create new category option */}
              {search.trim() && !exactMatch && (
                <>
                  <CommandGroup>
                    <CommandItem
                      value={`create-${search}`}
                      onSelect={() =>
                        createCategoryMutation.mutate(search.trim())
                      }
                      disabled={createCategoryMutation.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span>
                        Create &quot;{search.trim()}&quot;
                        {createCategoryMutation.isPending && " ..."}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Categories with checkboxes */}
              {filteredCategories.length > 0 && (
                <CommandGroup
                  heading={search.trim() ? "Matching" : "All Categories"}
                >
                  {filteredCategories.map((category) =>
                    renderCategoryItem(category, "multi"),
                  )}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>

        {/* Apply button for multi-select mode */}
        {viewMode === "categories" && (
          <div className="border-t p-2">
            <Button
              className="w-full"
              onClick={() => setMultipleCategoriesMutation.mutate()}
              disabled={setMultipleCategoriesMutation.isPending}
            >
              {setMultipleCategoriesMutation.isPending
                ? "Applying..."
                : selectedCategoryIds.length === 0
                  ? "Clear Categories"
                  : `Apply ${selectedCategoryIds.length} ${selectedCategoryIds.length === 1 ? "Category" : "Categories"}`}
            </Button>
          </div>
        )}
      </CommandDialog>

      <BulkDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  )
}
