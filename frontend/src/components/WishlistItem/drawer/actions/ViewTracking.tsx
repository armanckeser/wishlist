import { Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

interface ViewTrackingProps {
  className?: string
  /** Render as icon-only button (for merged button groups) */
  iconOnly?: boolean
}

/**
 * Button to open item's tracking URL in new tab.
 * Only shown for items with tracking status.
 */
export function ViewTracking({
  className,
  iconOnly = false,
}: ViewTrackingProps) {
  const { item } = useWishlistItem()

  // Type guard to check if item has tracking_url
  const trackingUrl = "tracking_url" in item ? item.tracking_url : undefined

  const handleClick = () => {
    if (!trackingUrl) return
    window.open(trackingUrl, "_blank", "noopener,noreferrer")
  }

  if (iconOnly) {
    return (
      <Button
        className={cn("h-full px-3", className)}
        onClick={handleClick}
        disabled={!trackingUrl}
        aria-label="View tracking"
      >
        <Package className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      className={cn("h-12 flex-1", className)}
      onClick={handleClick}
      disabled={!trackingUrl}
    >
      <Package className="mr-2 h-4 w-4" />
      View Tracking
    </Button>
  )
}
