import { useState } from "react"

import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface ImageProps {
  className?: string
  /** Size variant for different layouts */
  size?: "thumbnail" | "card" | "large"
  /** Show ready indicator overlay */
  showReadyIndicator?: boolean
  /** Show purchased overlay */
  showPurchasedOverlay?: boolean
}

/**
 * Product image with loading/error states.
 * Handles lazy loading, fallback to first letter, and state overlays.
 */
export function Image({
  className,
  size = "card",
  showPurchasedOverlay = true,
}: ImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const { item, maturity, isPurchased, isGifted, isSelected, selection } =
    useWishlistItem()

  const isSelectionMode = selection?.isSelectionMode ?? false
  const isReady = maturity.state === "ready"

  // Size-specific classes
  const sizeClasses = {
    thumbnail: "h-16 w-16",
    card: "aspect-[4/5] w-full",
    large: "aspect-square w-full",
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm bg-muted",
        sizeClasses[size],
        maturity.state === "cooling" && "opacity-90",
        maturity.state === "saving" && "opacity-95",
        isReady && !isPurchased && !isGifted && "ring-1 ring-milestone-gold/20",
        (isPurchased || isGifted) && "opacity-60 grayscale",
        isSelected && "opacity-80",
        className,
      )}
    >
      {/* Placeholder / skeleton */}
      {!imageLoaded && !imageError && item.image_url && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted-foreground/5" />
      )}

      {/* Error state - elegant placeholder */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-center">
            <div className="font-display text-4xl text-muted-foreground/30">
              ?
            </div>
          </div>
        </div>
      )}

      {/* Product image */}
      {item.image_url && !imageError && (
        <img
          src={item.image_url}
          alt={item.title}
          draggable="false"
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            imageLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      )}

      {/* No image provided */}
      {!item.image_url && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
          <span
            className={cn(
              "font-display font-light text-muted-foreground/20",
              size === "thumbnail" && "text-2xl",
              size === "card" && "text-6xl",
              size === "large" && "text-8xl",
            )}
          >
            {item.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Ready state accent - subtle gold corner (card only) */}
      {size === "card" &&
        isReady &&
        !isPurchased &&
        !isGifted &&
        !isSelectionMode && (
          <div
            className="absolute right-0 top-0 h-8 w-8"
            style={{
              background:
                "linear-gradient(225deg, var(--milestone-gold) 0%, transparent 60%)",
              opacity: 0.6,
            }}
          />
        )}

      {/* Purchased/Gifted overlay */}
      {showPurchasedOverlay && (isPurchased || isGifted) && size === "card" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground">
            {isGifted ? "Gifted" : "Purchased"}
          </span>
        </div>
      )}
    </div>
  )
}
