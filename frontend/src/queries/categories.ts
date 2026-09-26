import { CategoriesService, type CategorySuggestionRequest } from "@/client"

/**
 * Query options for fetching user's categories.
 */
export function categoriesQueryOptions() {
  return {
    queryFn: () => CategoriesService.readCategories(),
    queryKey: ["categories"] as const,
  }
}

/**
 * Query options for fetching category suggestions for a product.
 */
export function categorySuggestionsQueryOptions(
  request: CategorySuggestionRequest,
) {
  return {
    queryFn: () =>
      CategoriesService.getCategorySuggestions({ requestBody: request }),
    queryKey: ["category-suggestions", request] as const,
    // Only fetch when we have meaningful data to suggest from
    enabled: Boolean(
      request.product_url ||
        request.title ||
        request.breadcrumbs?.length ||
        request.brand,
    ),
    // Cache suggestions for a while since they don't change frequently
    staleTime: 5 * 60 * 1000, // 5 minutes
  }
}
