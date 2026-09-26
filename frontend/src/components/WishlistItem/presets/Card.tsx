import type { DeliveryStatus } from "@/client"
import { useLongPress } from "@/hooks/useLongPress"
import { cn } from "@/lib/utils"
import type { WishlistItemPublic } from "@/types"

import { PriceAlertIcon } from "../../PriceTracking/PriceAlertIcon"
import { PriceChangeChip } from "../../PriceTracking/PriceChangeChip"
import {
  DeliveryProgress,
  type DeliveryStage,
} from "../../Tracking/DeliveryProgress"
import { useWishlistItem, WishlistItemProvider } from "../context"
import { Brand } from "../primitives/Brand"
import { Categories } from "../primitives/Categories"
import { GiftBadge } from "../primitives/GiftBadge"
import { Image } from "../primitives/Image"
import { Maturity } from "../primitives/Maturity"
import { Price } from "../primitives/Price"
import { SelectionCheckbox } from "../primitives/SelectionCheckbox"
import { Title } from "../primitives/Title"

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

interface CardProps {
  item: WishlistItemPublic
  onClick?: () => void
  className?: string
}

/**
 * Luxury wishlist item card for magazine editorial masonry layout.
 * Shows product image, name, price, and maturity state with elegant gamification.
 * Supports selection mode with long-press to enter and checkbox for selection.
 */
export function Card({ item, onClick, className }: CardProps) {
  return (
    <WishlistItemProvider item={item}>
      <CardInner onClick={onClick} className={className} />
    </WishlistItemProvider>
  )
}

/**
 * Inner component that has access to context.
 */
function CardInner({
  onClick,
  className,
}: {
  onClick?: () => void
  className?: string
}) {
  const {
    item,
    isPurchased,
    isGifted,
    isArchived,
    isTracking,
    isSelected,
    selection,
    hasTrackingNumber,
    trackingStatus,
    estimatedDeliveryAt,
  } = useWishlistItem()

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

  const isMostDesired =
    item.is_most_desired && !isArchived && !isPurchased && !isGifted

  const cardContent = (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "touch-card", // iOS touch prevention
        "group relative flex w-full cursor-pointer flex-col text-left",
        "bg-transparent border-none p-0 font-inherit",
        "transition-transform duration-300 ease-out",
        !isSelectionMode && "hover:scale-[1.02] active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected &&
          "ring-1 ring-primary/50 ring-offset-2 ring-offset-background rounded",
        // Archived items: grayscale + reduced opacity
        isArchived && "grayscale opacity-60",
        className,
      )}
      {...(isSelectionMode ? {} : longPressPointerHandlers)}
    >
      {/* Selection checkbox overlay */}
      <SelectionCheckbox position="overlay" />

      {/* Image container */}
      <Image size="card" />

      {/* Content section */}
      <div className="mt-3 space-y-1">
        {/* Product title */}
        <Title className="text-sm" lineClamp={1} />

        {/* Price + Brand + Categories - flex layout with truncation */}
        <div className="flex items-baseline gap-1">
          {/* Price - never shrinks */}
          <Price size="lg" className="shrink-0" />
          {item.status === "wishlisted" && (
            <>
              <PriceChangeChip
                tracking={item.price_tracking}
                currentPriceCents={item.price_cents}
              />
              <PriceAlertIcon tracking={item.price_tracking} />
            </>
          )}

          {/* Brand - takes remaining space (shared with category if present), truncates */}
          <Brand
            separator="·"
            className="min-w-0 flex-1 truncate font-display text-sm font-light"
          />

          {/* Categories - takes remaining space (shared with brand if present), truncates */}
          <Categories
            mode="compact"
            className="min-w-0 flex-1 font-display text-sm font-light"
          />
        </div>

        {/* Status section - Delivery progress for tracking, Maturity for wishlisted, Gift indicator for gifted */}
        {!isArchived && (
          <div className="pt-1">
            {hasTrackingNumber || isTracking ? (
              <DeliveryProgress
                stage={mapDeliveryStatusToStage(trackingStatus)}
                estimatedDelivery={estimatedDeliveryAt ?? undefined}
              />
            ) : isGifted ? (
              <GiftBadge showGifter />
            ) : !isPurchased ? (
              <Maturity variant="inline" />
            ) : null}
          </div>
        )}
      </div>
    </button>
  )

  // Wrap with gold shimmer border for most desired items
  if (isMostDesired) {
    return (
      <div className="rounded p-[2px] ring-2 ring-milestone-gold/50 ring-offset-2 ring-offset-background">
        {cardContent}
      </div>
    )
  }

  return cardContent
}
