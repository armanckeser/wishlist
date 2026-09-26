import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import {
  serializeViewState,
  type WishlistViewState,
} from "@/components/Wishlist"

interface WishlistNavigation {
  /** Navigate to select an item (opens drawer) */
  selectItem: (itemId: string) => void
  /** Clear item selection (closes drawer) */
  clearSelection: () => void
  /** Update filters/sort/group state */
  updateViewState: (state: WishlistViewState) => void
}

interface UseWishlistNavigationOptions {
  /** User ID for the wishlist being viewed. If provided, navigates to /$userId route. */
  userId?: string
}

/**
 * Hook for wishlist navigation actions.
 * Encapsulates URL-based state management for item selection and filters.
 */
export function useWishlistNavigation(
  viewState: WishlistViewState,
  options: UseWishlistNavigationOptions = {},
): WishlistNavigation {
  const navigate = useNavigate()
  const { userId } = options

  const selectItem = useCallback(
    (itemId: string) => {
      if (userId) {
        navigate({
          to: "/$userId",
          params: { userId },
          search: serializeViewState(viewState, itemId),
        })
      } else {
        navigate({ to: "/", search: serializeViewState(viewState, itemId) })
      }
    },
    [navigate, viewState, userId],
  )

  const clearSelection = useCallback(() => {
    if (userId) {
      navigate({
        to: "/$userId",
        params: { userId },
        search: serializeViewState(viewState),
        replace: true,
      })
    } else {
      navigate({
        to: "/",
        search: serializeViewState(viewState),
        replace: true,
      })
    }
  }, [navigate, viewState, userId])

  const updateViewState = useCallback(
    (newState: WishlistViewState) => {
      if (userId) {
        navigate({
          to: "/$userId",
          params: { userId },
          search: serializeViewState(newState),
          replace: true,
        })
      } else {
        navigate({
          to: "/",
          search: serializeViewState(newState),
          replace: true,
        })
      }
    },
    [navigate, userId],
  )

  return { selectItem, clearSelection, updateViewState }
}
