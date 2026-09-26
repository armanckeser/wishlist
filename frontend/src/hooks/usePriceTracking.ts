import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { ApiError, PriceTrackingService } from "@/client"

/**
 * Pull a human-readable message out of an API error.
 * The backend returns plain-language `detail` strings for price tracking
 * failures, so we surface those verbatim.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError) {
    const detail = (error.body as { detail?: unknown } | undefined)?.detail
    if (typeof detail === "string" && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string }
      if (first?.msg) return first.msg
    }
    if (error.status === 429) {
      return "We just checked this one. Try again in a few minutes."
    }
    if (error.status === 503) {
      return "Price tracking is turned off on this server."
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function priceHistoryQueryOptions(itemId: string) {
  return {
    queryKey: ["price-history", itemId] as const,
    queryFn: () => PriceTrackingService.readPriceHistory({ itemId }),
  }
}

interface UsePriceTrackingOptions {
  /** Whether to fetch the history (e.g. only while the drawer is open). */
  fetchHistory?: boolean
}

/**
 * Price tracking data + actions for a single wishlist item.
 *
 * Mutations invalidate the wishlist queries so the embedded `price_tracking`
 * summary on the item refreshes alongside the detailed history.
 */
export function usePriceTracking(
  itemId: string,
  { fetchHistory = true }: UsePriceTrackingOptions = {},
) {
  const queryClient = useQueryClient()

  const history = useQuery({
    ...priceHistoryQueryOptions(itemId),
    enabled: fetchHistory,
    staleTime: 60_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    queryClient.invalidateQueries({ queryKey: ["price-history", itemId] })
  }

  const enable = useMutation({
    mutationFn: () => PriceTrackingService.enablePriceTracking({ itemId }),
    onSuccess: invalidate,
  })

  const disable = useMutation({
    mutationFn: () => PriceTrackingService.disablePriceTracking({ itemId }),
    onSuccess: invalidate,
  })

  const restart = useMutation({
    mutationFn: () => PriceTrackingService.restartPriceTracking({ itemId }),
    onSuccess: invalidate,
  })

  const check = useMutation({
    mutationFn: () => PriceTrackingService.checkPriceNow({ itemId }),
    onSuccess: invalidate,
  })

  return { history, enable, disable, restart, check }
}
