import type { PurchasedItemPublic } from "@/client"

import { formatRelativeTime } from "../../utils"
import { TrackingDisplay } from "./TrackingDisplay"

interface PurchasedInfoProps {
  item: PurchasedItemPublic
  daysWishlisted: number
}

/**
 * Info display for purchased items.
 * Shows when item was added, when it was purchased.
 * If tracking data exists, shows delivery progress instead of external link.
 */
export function PurchasedInfo({ item, daysWishlisted }: PurchasedInfoProps) {
  const formatAddedText = (days: number): string => {
    const relative = formatRelativeTime(days)
    return relative === "today" ? "Added today" : `Added ${relative} ago`
  }

  // Show tracking if we have a tracking number (status syncs later)
  const hasTrackingData = Boolean(item.tracking_number)

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
          {formatAddedText(daysWishlisted)}
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Purchased {new Date(item.purchased_at).toLocaleDateString()}
        </p>
      </div>

      {/* Show delivery progress if tracking data exists */}
      {hasTrackingData && (
        <TrackingDisplay
          trackingCarrier={item.tracking_carrier}
          trackingStatusLabel={item.tracking_status_label}
          trackingStatus={item.tracking_status}
          trackingUrl={item.tracking_url}
          estimatedDeliveryAt={item.estimated_delivery_at}
          trackingEvents={item.tracking_events}
        />
      )}
    </div>
  )
}
