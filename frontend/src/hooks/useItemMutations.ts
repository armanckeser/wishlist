import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PurchaseRequest } from "@/client"
import { WishlistService } from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

interface UseItemMutationsOptions {
  userId: string
  onSuccess?: () => void
}

interface PurchaseMutationVariables {
  itemId: string
  silent?: boolean
  trackingUrl?: string
  actualPricePaidCents?: number
  trackingNumber?: string
  trackingCarrier?: string
}

/**
 * Encapsulates wishlist item mutations (purchase, archive, unarchive).
 * Handles query invalidation and error toasts.
 */
export function useItemMutations({
  userId,
  onSuccess,
}: UseItemMutationsOptions) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const invalidateWishlist = () => {
    queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
  }

  const purchaseMutation = useMutation({
    mutationFn: ({
      itemId,
      trackingUrl,
      actualPricePaidCents,
      trackingNumber,
      trackingCarrier,
    }: PurchaseMutationVariables) => {
      const requestBody: PurchaseRequest | undefined =
        trackingUrl || actualPricePaidCents || trackingNumber || trackingCarrier
          ? {
              tracking_url: trackingUrl,
              actual_price_paid_cents: actualPricePaidCents,
              tracking_number: trackingNumber,
              tracking_carrier: trackingCarrier,
            }
          : undefined

      return WishlistService.purchaseItem({ itemId, requestBody })
    },
    onSuccess: (_, { silent }) => {
      if (!silent) {
        showSuccessToast("Item marked as purchased")
      }
      onSuccess?.()
      invalidateWishlist()
      queryClient.invalidateQueries({ queryKey: ["budget"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const archiveMutation = useMutation({
    mutationFn: (itemId: string) =>
      WishlistService.bulkArchiveItemsEndpoint({
        requestBody: { item_ids: [itemId] },
      }),
    onSuccess: () => {
      showSuccessToast("Item archived")
      onSuccess?.()
      invalidateWishlist()
    },
    onError: handleError.bind(showErrorToast),
  })

  const unarchiveMutation = useMutation({
    mutationFn: (itemId: string) =>
      WishlistService.bulkUnarchiveItemsEndpoint({
        requestBody: { item_ids: [itemId] },
      }),
    onSuccess: () => {
      showSuccessToast("Item restored to wishlist")
      onSuccess?.()
      invalidateWishlist()
    },
    onError: handleError.bind(showErrorToast),
  })

  return {
    purchase: (
      itemId: string,
      options?: {
        silent?: boolean
        trackingUrl?: string
        actualPricePaidCents?: number
        trackingNumber?: string
        trackingCarrier?: string
      },
    ) =>
      purchaseMutation.mutate({
        itemId,
        silent: options?.silent,
        trackingUrl: options?.trackingUrl,
        actualPricePaidCents: options?.actualPricePaidCents,
        trackingNumber: options?.trackingNumber,
        trackingCarrier: options?.trackingCarrier,
      }),
    archive: (itemId: string) => archiveMutation.mutate(itemId),
    unarchive: (itemId: string) => unarchiveMutation.mutate(itemId),
    isPurchasing: purchaseMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
  }
}
