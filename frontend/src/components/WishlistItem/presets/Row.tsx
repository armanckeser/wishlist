import type { DeliveryStatus } from "@/client"
import {
  DeliveryProgress,
  type DeliveryStage,
} from "@/components/Tracking/DeliveryProgress"
import { useLongPress } from "@/hooks/useLongPress"
import { cn } from "@/lib/utils"
import type { WishlistItemPublic } from "@/types"
import { PriceAlertIcon } from "../../PriceTracking/PriceAlertIcon"
import { PriceChangeChip } from "../../PriceTracking/PriceChangeChip"
import { useWishlistItem, WishlistItemProvider } from "../context"
import { Brand } from "../primitives/Brand"
import { Image } from "../primitives/Image"
import { Price } from "../primitives/Price"
import { SelectionCheckbox } from "../primitives/SelectionCheckbox"
import { Title } from "../primitives/Title"
import { formatTimeUntilReady } from "../utils"

/**
 * Map backend DeliveryStatus to frontend DeliveryStage.
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

interface RowProps {
  item: WishlistItemPublic
  onClick?: () => void
  className?: string
}

/**
 * Compact list row for wishlist items.
 * Shows thumbnail, title, price, and status in a single row.
 * Supports selection mode with long-press to enter and checkbox for selection.
 *
 * For items with tracking, the DeliveryProgress is rendered OUTSIDE the main
 * button element so the expand toggle can be clicked independently.
 */
export function Row({ item, onClick, className }: RowProps) {
  return (
    <WishlistItemProvider item={item}>
      <RowInner onClick={onClick} className={className} />
    </WishlistItemProvider>
  )
}

/**
 * Inner component that has access to context.
 */
function RowInner({
  onClick,
  className,
}: {
  onClick?: () => void
  className?: string
}) {
  const {
    item,
    maturity,
    isPurchased,
    isGifted,
    isArchived,
    isTracking,
    isSelected,
    selection,
    hasTrackingNumber,
    trackingStatus,
    trackingEvents,
    estimatedDeliveryAt,
    isDelivered,
  } = useWishlistItem()

  // Determine if this item should show tracking progress
  const showTrackingProgress = hasTrackingNumber || isTracking

  const isSelectionMode = selection?.isSelectionMode ?? false

  // Destructure onClick and onContextMenu - we handle them separately
  const {
    onClick: longPressOnClick,
    onContextMenu: _,
    ...longPressPointerHandlers
  } = useLongPress({
    enabled: !!selection && !isSelectionMode,
    onLongPress: () => selection?.enterSelectionMode(item.id),
  })

  // Taps arrive as real clicks. The long-press hook only gets to veto them:
  // a click that ended a long-press or a scroll never opens anything.
  const handleClick = (event: React.MouseEvent) => {
    longPressOnClick(event)
    if (event.defaultPrevented) return

    // Normal click handling
    if (isSelectionMode) {
      selection?.toggleItem(item.id)
    } else {
      onClick?.()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (isSelectionMode) {
        selection?.toggleItem(item.id)
      } else {
        onClick?.()
      }
    }
  }

  // Always prevent context menu when selection is available (prevents "Copy Image" on long-press)
  const handleContextMenu = (event: React.MouseEvent) => {
    if (selection) {
      event.preventDefault()
    }
  }

  const containerClasses = cn(
    "touch-card", // iOS touch prevention
    "group rounded p-2",
    "transition-colors duration-200",
    !isSelectionMode && "hover:bg-muted/50",
    // Only grayscale purchased/gifted if they don't have active tracking
    (isPurchased || isGifted) &&
      !showTrackingProgress &&
      "opacity-60 grayscale",
    isArchived && "grayscale opacity-60",
    isSelected &&
      "bg-primary/5 ring-1 ring-primary/50 ring-offset-2 ring-offset-background",
    className,
  )

  return (
    <div className={containerClasses}>
      {/* Main clickable row - opens drawer */}
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        className={cn(
          "flex w-full cursor-pointer items-center gap-4 text-left",
          "bg-transparent border-none font-inherit",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded",
        )}
        {...(isSelectionMode ? {} : longPressPointerHandlers)}
      >
        {/* Selection checkbox - inline position for row layout */}
        <SelectionCheckbox position="inline" />

        {/* Thumbnail */}
        <Image size="thumbnail" showPurchasedOverlay={false} />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <Title className="truncate text-sm" lineClamp={1} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Brand />
            {!showTrackingProgress &&
              !isPurchased &&
              !isGifted &&
              !isArchived && (
                <>
                  {/* Show separator only if brand exists */}
                  <RowTimeSeparator />
                  <span
                    className={cn(
                      maturity.state === "ready" && "text-milestone-gold",
                    )}
                  >
                    {formatTimeUntilReady(maturity.daysUntilReady)}
                  </span>
                </>
              )}
          </div>
        </div>

        {/* Price section */}
        <div className="flex-shrink-0 text-right">
          <Price size="md" className="font-display" />
          {item.status === "wishlisted" && (
            <div className="flex items-center justify-end gap-1.5">
              <PriceChangeChip
                tracking={item.price_tracking}
                currentPriceCents={item.price_cents}
              />
              <PriceAlertIcon tracking={item.price_tracking} />
            </div>
          )}
          {/* Status label */}
          {showTrackingProgress ? (
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {isDelivered
                ? "Delivered"
                : isTracking
                  ? "Tracking"
                  : "On the Way"}
            </p>
          ) : !isPurchased && !isGifted && !isArchived ? (
            <p
              className={cn(
                "text-[9px] font-medium uppercase tracking-wide",
                maturity.state === "cooling" && "text-muted-foreground/60",
                maturity.state === "growing" && "text-muted-foreground/70",
                maturity.state === "ready" && "text-milestone-gold/80",
              )}
            >
              {maturity.label}
            </p>
          ) : isPurchased ? (
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Purchased
            </p>
          ) : isGifted ? (
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Gifted
            </p>
          ) : isArchived ? (
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Archived
            </p>
          ) : null}
        </div>
      </button>

      {/* Tracking progress - OUTSIDE the button, full width */}
      {showTrackingProgress && (
        <div className="mt-2">
          <DeliveryProgress
            stage={mapDeliveryStatusToStage(trackingStatus)}
            estimatedDelivery={estimatedDeliveryAt ?? undefined}
            events={trackingEvents}
            expandable
          />
        </div>
      )}
    </div>
  )
}

/**
 * Separator that only renders if brand exists.
 */
function RowTimeSeparator() {
  const { brand } = useWishlistItem()
  if (!brand) return null
  return <span>·</span>
}
