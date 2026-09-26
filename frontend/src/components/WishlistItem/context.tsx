import type { ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"

import type { DeliveryStatus, TrackingEventPublic } from "@/client"
import { useBudgetInfo } from "@/contexts/BudgetInfoContext"
import { type MaturityInfo, useCooloff } from "@/contexts/CooloffContext"
import {
  type SelectionContextValue,
  useSelectionOptional,
} from "@/contexts/SelectionContext"
import { useWishlistRole } from "@/contexts/WishlistRoleContext"
import type { WishlistItemPublic } from "@/types"

import { extractBrandFromUrl } from "./utils"

/**
 * Optional data for purchase action.
 */
export interface PurchaseOptions {
  trackingUrl?: string
  actualPricePaidCents?: number
  trackingNumber?: string
  trackingCarrier?: string
  silent?: boolean
}

/**
 * Optional data for gift action (viewer gifting to owner).
 */
export interface GiftOptions {
  giftMessage?: string
  gifterDisplayName?: string
  trackingUrl?: string
}

/**
 * Callbacks for item actions. Presence determines what UI is shown.
 * Used by drawer presets for edit/archive/delete/buy functionality.
 */
export interface WishlistItemActions {
  onEdit?: (item: WishlistItemPublic) => void
  onArchive?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
  onBuy?: (item: WishlistItemPublic, options?: PurchaseOptions) => void
  onGift?: (item: WishlistItemPublic, options?: GiftOptions) => void
}

/**
 * Context value available to all WishlistItem children.
 * Computed once at the root, consumed by primitives.
 */
export interface WishlistItemContextValue {
  // Core data
  item: WishlistItemPublic
  maturity: MaturityInfo

  // Derived state (computed once, used many places)
  isPurchased: boolean
  isGifted: boolean
  isArchived: boolean
  isTracking: boolean
  isReadyToTreat: boolean
  isCooling: boolean
  isAffordable: boolean
  brand: string | null
  freezePenaltyDays: number

  // Tracking info (for items with tracking_number)
  hasTrackingNumber: boolean
  trackingStatus: DeliveryStatus | null
  trackingStatusLabel: string | null
  trackingCarrier: string | null
  trackingEvents: TrackingEventPublic[]
  estimatedDeliveryAt: Date | null
  isDelivered: boolean
  isOnTheWay: boolean

  // Selection (from SelectionContext)
  selection: SelectionContextValue | null
  isSelected: boolean

  // Actions - optional, used by drawer presets
  actions: WishlistItemActions

  // Drawer control - optional, only set for drawer variant
  close?: () => void
}

const WishlistItemContext = createContext<WishlistItemContextValue | null>(null)

/**
 * Hook to access WishlistItem context.
 * Must be used within a WishlistItem.Root component.
 */
export function useWishlistItem(): WishlistItemContextValue {
  const context = useContext(WishlistItemContext)
  if (!context) {
    throw new Error("useWishlistItem must be used within a WishlistItem.Root")
  }
  return context
}

interface WishlistItemProviderProps {
  children: ReactNode
  item: WishlistItemPublic
  actions?: WishlistItemActions
  onClose?: () => void
}

/**
 * Provider that computes all derived state once and makes it available
 * to all child components via context.
 */
export function WishlistItemProvider({
  children,
  item,
  actions = {},
  onClose,
}: WishlistItemProviderProps) {
  const { getMaturityInfo, freezePenaltyDays } = useCooloff()
  const budgetInfo = useBudgetInfo()
  const selection = useSelectionOptional()
  const { role } = useWishlistRole()

  const value = useMemo<WishlistItemContextValue>(() => {
    const isViewer = role === "viewer"
    const maturity = getMaturityInfo(item, budgetInfo, isViewer)
    const isPurchased = item.status === "purchased"
    const isGifted = item.status === "gifted"
    const isArchived = item.status === "archived"
    const isTracking = item.status === "tracking"
    const isAffordable = budgetInfo?.isAffordable(item.price_cents) ?? false
    const isSelected = selection?.isSelected(item.id) ?? false

    // Extract tracking info (type-safe access)
    const hasTrackingNumber =
      "tracking_number" in item && !!item.tracking_number
    const trackingStatus =
      "tracking_status" in item
        ? (item.tracking_status as DeliveryStatus | null)
        : null
    const trackingStatusLabel =
      "tracking_status_label" in item
        ? (item.tracking_status_label as string | null)
        : null
    const trackingCarrier =
      "tracking_carrier" in item
        ? (item.tracking_carrier as string | null)
        : null
    const trackingEvents =
      "tracking_events" in item
        ? ((item.tracking_events as TrackingEventPublic[]) ?? [])
        : []
    const estimatedDeliveryAt =
      "estimated_delivery_at" in item && item.estimated_delivery_at
        ? new Date(item.estimated_delivery_at)
        : null

    const isDelivered = trackingStatus === "delivered"
    const isOnTheWay =
      hasTrackingNumber &&
      !isDelivered &&
      trackingStatus !== null &&
      trackingStatus !== "not_found"

    return {
      item,
      maturity,
      isPurchased,
      isGifted,
      isArchived,
      isTracking,
      isReadyToTreat: maturity.state === "ready",
      isCooling: maturity.state === "cooling",
      isAffordable,
      brand: extractBrandFromUrl(item.product_url),
      freezePenaltyDays,
      hasTrackingNumber,
      trackingStatus,
      trackingStatusLabel,
      trackingCarrier,
      trackingEvents,
      estimatedDeliveryAt,
      isDelivered,
      isOnTheWay,
      selection,
      isSelected,
      actions,
      close: onClose,
    }
  }, [
    item,
    actions,
    onClose,
    getMaturityInfo,
    freezePenaltyDays,
    budgetInfo,
    selection,
    role,
  ])

  return (
    <WishlistItemContext.Provider value={value}>
      {children}
    </WishlistItemContext.Provider>
  )
}
