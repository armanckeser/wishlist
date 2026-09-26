import type { GiftedItemPublic } from "@/client"

import { TrackingDisplay } from "./TrackingDisplay"

interface GiftedInfoProps {
  item: GiftedItemPublic
}

/**
 * Info display for gifted items.
 * Shows gifter name, date received, gift message.
 * If tracking data exists, shows delivery progress.
 */
export function GiftedInfo({ item }: GiftedInfoProps) {
  const gifterName = item.gifter_display_name
  // Show tracking if we have a tracking number (status syncs later)
  const hasTrackingData = Boolean(item.tracking_number)

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
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
