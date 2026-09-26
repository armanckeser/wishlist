import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { GiftRequest } from "@/client"
import { WishlistService } from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

interface UseGiftMutationOptions {
  ownerId: string
  onSuccess?: () => void
}

interface GiftMutationVariables {
  itemId: string
  giftMessage?: string
  gifterDisplayName?: string
  trackingUrl?: string
  silent?: boolean
}

/**
 * Mutation hook for gifting items from someone else's wishlist.
 */
export function useGiftMutation({
  ownerId,
  onSuccess,
}: UseGiftMutationOptions) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const giftMutation = useMutation({
    mutationFn: ({
      itemId,
      giftMessage,
      gifterDisplayName,
      trackingUrl,
    }: GiftMutationVariables) => {
      const requestBody: GiftRequest | undefined =
        giftMessage || gifterDisplayName || trackingUrl
          ? {
              gift_message: giftMessage,
              gifter_display_name: gifterDisplayName,
              tracking_url: trackingUrl,
            }
          : undefined

      return WishlistService.giftItem({ itemId, requestBody })
    },
    onSuccess: (_data, variables) => {
      if (!variables.silent) {
        showSuccessToast("Gift sent! They'll be so happy.")
      }
      onSuccess?.()
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", ownerId] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return {
    gift: (
      itemId: string,
      options?: {
        giftMessage?: string
        gifterDisplayName?: string
        trackingUrl?: string
        silent?: boolean
      },
    ) =>
      giftMutation.mutate({
        itemId,
        giftMessage: options?.giftMessage,
        gifterDisplayName: options?.gifterDisplayName,
        trackingUrl: options?.trackingUrl,
        silent: options?.silent,
      }),
    isGifting: giftMutation.isPending,
  }
}
