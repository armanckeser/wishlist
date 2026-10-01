import { cn } from "@/lib/utils"
import type { WishlistItemPublic } from "@/types"

import { useWishlistItem, WishlistItemProvider } from "../context"
import { Image } from "../primitives/Image"
import { Maturity } from "../primitives/Maturity"
import { Price } from "../primitives/Price"
import { Title } from "../primitives/Title"

interface HorizontalCardProps {
  item: WishlistItemPublic
  onClick?: () => void
  className?: string
  /** Show maturity indicator */
  showMaturity?: boolean
  /** Show gold border for most desired items */
  showMostDesiredBorder?: boolean
}

/**
 * Horizontal variant of wishlist item card.
 * Uses the same primitives as the vertical Card preset.
 * Ideal for spotlight/featured item display.
 */
export function HorizontalCard({
  item,
  onClick,
  className,
  showMaturity = true,
  showMostDesiredBorder = true,
}: HorizontalCardProps) {
  return (
    <WishlistItemProvider item={item}>
      <HorizontalCardInner
        onClick={onClick}
        className={className}
        showMaturity={showMaturity}
        showMostDesiredBorder={showMostDesiredBorder}
      />
    </WishlistItemProvider>
  )
}

function HorizontalCardInner({
  onClick,
  className,
  showMaturity,
  showMostDesiredBorder,
}: Omit<HorizontalCardProps, "item">) {
  const { item, isPurchased, isGifted, isArchived } = useWishlistItem()

  const isMostDesired =
    showMostDesiredBorder &&
    item.is_most_desired &&
    !isArchived &&
    !isPurchased &&
    !isGifted

  const cardContent = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-4 rounded-lg p-3 text-left",
        "bg-card border border-border",
        "transition-[background-color,transform] duration-200",
        "hover:bg-accent/50 active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        (isArchived || isPurchased || isGifted) && "grayscale opacity-60",
        className,
      )}
    >
      {/* Image - thumbnail size */}
      <div className="shrink-0">
        <Image size="thumbnail" showPurchasedOverlay={false} />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Title row */}
        <Title className="text-sm" lineClamp={1} />

        {/* Price */}
        <Price size="lg" className="tabular-nums" />

        {/* Maturity - full width progress bar */}
        {showMaturity && !isPurchased && !isGifted && !isArchived && (
          <Maturity variant="inline" showLabel={false} className="mt-1" />
        )}
      </div>
    </button>
  )

  // Wrap with gold border for most desired items
  if (isMostDesired) {
    return (
      <div className="rounded-lg p-[2px] ring-2 ring-milestone-gold/50 ring-offset-2 ring-offset-background">
        {cardContent}
      </div>
    )
  }

  return cardContent
}
