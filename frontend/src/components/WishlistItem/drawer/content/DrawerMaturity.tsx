import { useState } from "react"

import type { DeliveryStatus } from "@/client"
import {
  DeliveryProgress,
  type DeliveryStage,
} from "@/components/Tracking/DeliveryProgress"
import { TrackingEvents } from "@/components/Tracking/TrackingEvents"
import { MaturityProgress } from "@/components/Wishlist/MaturityProgress"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"
import { formatRelativeTime, formatTimeUntilReady } from "../../utils"

/**
 * Map backend DeliveryStatus to frontend DeliveryStage for progress display.
 */
function mapDeliveryStatusToStage(
  status: DeliveryStatus | null,
): DeliveryStage {
  if (!status) return "label_created"
  switch (status) {
    case "not_found":
    case "info_received":
      return "label_created"
    case "in_transit":
      return "in_transit"
    case "out_for_delivery":
      return "out_for_delivery"
    case "delivered":
      return "delivered"
    case "exception":
    case "expired":
      return "exception"
    default:
      return "label_created"
  }
}

/**
 * Maturity indicator section for drawer.
 * Shows progress bar and state label for wishlisted items,
 * or purchase/gift date for purchased/gifted items.
 * Supports toggle between label and "added X ago".
 */
export function DrawerMaturity() {
  const {
    item,
    maturity,
    isPurchased,
    isGifted,
    isArchived,
    isTracking,
    hasTrackingNumber,
    trackingStatus,
    trackingStatusLabel,
    trackingCarrier,
    trackingEvents,
    estimatedDeliveryAt,
    isDelivered,
  } = useWishlistItem()
  const [showAddedDate, setShowAddedDate] = useState(false)
  const [showEvents, setShowEvents] = useState(false)

  // Helper to format "Added X ago" or "Added today"
  const formatAddedText = (days: number): string => {
    const relative = formatRelativeTime(days)
    return relative === "today" ? "Added today" : `Added ${relative} ago`
  }

  const addedText = formatAddedText(maturity.daysWishlisted)

  // Archived items show added date first, then archive date
  if (isArchived) {
    return (
      <div className="space-y-1 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          {addedText}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Archived{" "}
          {"archived_at" in item &&
            new Date(item.archived_at).toLocaleDateString()}
        </p>
      </div>
    )
  }

  // Items with tracking data show delivery progress and events
  if (hasTrackingNumber || isTracking) {
    return (
      <div className="space-y-3 pt-2">
        {/* Carrier and status label */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            {trackingCarrier ?? "Package"} · {trackingStatusLabel ?? "Pending"}
          </p>
          {isDelivered && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
              Delivered
            </span>
          )}
        </div>

        {/* Delivery progress milestones */}
        <DeliveryProgress
          stage={mapDeliveryStatusToStage(trackingStatus)}
          estimatedDelivery={estimatedDeliveryAt ?? undefined}
        />

        {/* Toggle button for events */}
        {trackingEvents.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowEvents(!showEvents)}
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {showEvents
                ? "Hide updates"
                : `View ${trackingEvents.length} update${trackingEvents.length === 1 ? "" : "s"}`}
            </button>

            {/* Expandable events list */}
            {showEvents && (
              <div className="mt-3 border-t border-border/40 pt-3">
                <TrackingEvents events={trackingEvents} maxVisibleEvents={3} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Gifted items show gift info and date
  if (isGifted && item.status === "gifted") {
    const gifterName = item.gifter_display_name
    return (
      <div className="space-y-1 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          {gifterName ? `Gift from ${gifterName}` : "Gift"}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Received {new Date(item.gifted_at).toLocaleDateString()}
        </p>
        {item.gift_message && (
          <p className="mt-2 text-sm italic text-muted-foreground">
            "{item.gift_message}"
          </p>
        )}
      </div>
    )
  }

  // Purchased items show added date first, then purchase date
  if (isPurchased) {
    return (
      <div className="space-y-1 pt-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          {addedText}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Purchased{" "}
          {"purchased_at" in item &&
            new Date(item.purchased_at).toLocaleDateString()}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-2">
      {/* Progress bar with time remaining */}
      <div className="flex items-center gap-3">
        <MaturityProgress
          progress={maturity.progress}
          state={maturity.state}
          className="flex-1"
        />
        <span
          className={cn(
            "text-xs tabular-nums",
            maturity.state === "ready"
              ? "text-milestone-gold"
              : "text-muted-foreground",
          )}
        >
          {formatTimeUntilReady(maturity.daysUntilReady)}
        </span>
      </div>

      {/* State label - tappable to toggle "added X ago" */}
      <button
        type="button"
        onClick={() => setShowAddedDate(!showAddedDate)}
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.2em] transition-colors",
          "hover:opacity-80 active:opacity-60",
          maturity.state === "cooling" && "text-muted-foreground/60",
          maturity.state === "growing" && "text-muted-foreground/70",
          maturity.state === "saving" && "text-muted-foreground/80",
          maturity.state === "ready" && "text-milestone-gold/80",
        )}
        aria-label="Toggle added date display"
      >
        {showAddedDate ? addedText : maturity.label}
      </button>
    </div>
  )
}
