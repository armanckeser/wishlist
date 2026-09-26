/**
 * Context for most desired item functionality.
 * Provides the current most desired item and calculation helpers for
 * days setback and projected affordability date.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react"

import { WishlistService } from "@/client"
import { useBudgetInfo } from "@/contexts/BudgetInfoContext"
import useCustomToast from "@/hooks/useCustomToast"
import type { WishlistItemPublic } from "@/types"
import { handleError } from "@/utils"

// =============================================================================
// Types
// =============================================================================

interface MostDesiredContextValue {
  /** The current most desired item, or null if none set */
  mostDesiredItem: WishlistItemPublic | null

  /**
   * Calculate how many days buying an item would set back the most desired goal.
   * Returns 0 if no most desired item or monthly rate is 0.
   */
  getDaysSetback: (priceCents: number) => number

  /**
   * Get the projected date when the most desired item will be affordable.
   * Returns null if no most desired item, already affordable, or rate is 0.
   */
  getProjectedDate: () => Date | null

  /**
   * Toggle the most desired status of an item.
   * If setting a new item, clears the flag from any previously marked item.
   */
  toggleMostDesired: (itemId: string) => void

  /** Whether a toggle mutation is in progress */
  isToggling: boolean
}

const MostDesiredContext = createContext<MostDesiredContextValue | undefined>(
  undefined,
)

// =============================================================================
// Constants
// =============================================================================

const DAYS_PER_MONTH = 30

// =============================================================================
// Provider
// =============================================================================

interface MostDesiredProviderProps {
  children: ReactNode
  items: WishlistItemPublic[]
  userId: string
}

export function MostDesiredProvider({
  children,
  items,
  userId,
}: MostDesiredProviderProps) {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const budgetInfo = useBudgetInfo()

  // Derive most desired item from wishlist data (only wishlisted items)
  // Purchased/archived items with the flag set are ignored
  const mostDesiredItem = useMemo(
    () =>
      items.find(
        (item) => item.is_most_desired && item.status === "wishlisted",
      ) ?? null,
    [items],
  )

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (itemId: string) =>
      WishlistService.toggleMostDesiredEndpoint({ itemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
    },
    onError: handleError.bind(showErrorToast),
  })

  // Calculate days setback for a given price
  const getDaysSetback = useCallback(
    (priceCents: number): number => {
      if (!budgetInfo || budgetInfo.monthlyRateCents <= 0) return 0
      const ratePerDay = budgetInfo.monthlyRateCents / DAYS_PER_MONTH
      return priceCents / ratePerDay
    },
    [budgetInfo],
  )

  // Calculate projected date for most desired item
  const getProjectedDate = useCallback((): Date | null => {
    if (!mostDesiredItem || !budgetInfo) return null
    if (budgetInfo.monthlyRateCents <= 0) return null

    const centsNeeded = mostDesiredItem.price_cents - budgetInfo.currentCents
    if (centsNeeded <= 0) return null // Already affordable

    const daysUntilAffordable = getDaysSetback(centsNeeded)
    const projectedDate = new Date()
    projectedDate.setDate(
      projectedDate.getDate() + Math.ceil(daysUntilAffordable),
    )
    return projectedDate
  }, [mostDesiredItem, budgetInfo, getDaysSetback])

  const value = useMemo<MostDesiredContextValue>(
    () => ({
      mostDesiredItem,
      getDaysSetback,
      getProjectedDate,
      toggleMostDesired: (itemId: string) => toggleMutation.mutate(itemId),
      isToggling: toggleMutation.isPending,
    }),
    [mostDesiredItem, getDaysSetback, getProjectedDate, toggleMutation],
  )

  return (
    <MostDesiredContext.Provider value={value}>
      {children}
    </MostDesiredContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access most desired item functionality.
 * Must be used within MostDesiredProvider.
 */
export function useMostDesired(): MostDesiredContextValue {
  const context = useContext(MostDesiredContext)
  if (!context) {
    throw new Error("useMostDesired must be used within a MostDesiredProvider")
  }
  return context
}

/**
 * Hook that returns the context value or null if not within provider.
 * Use this when the component may or may not be within the provider.
 */
export function useMostDesiredOptional(): MostDesiredContextValue | null {
  return useContext(MostDesiredContext) ?? null
}
