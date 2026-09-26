import type { DeliveryStatus, TrackingEvent } from "@/client"
import { DeliveryProgress } from "@/components/Tracking/DeliveryProgress"

import { mapDeliveryStatus } from "../../utils/mapDeliveryStatus"

interface TrackingDisplayProps {
  trackingCarrier?: string | null
  trackingStatusLabel?: string | null
  trackingStatus?: DeliveryStatus | null
  trackingUrl?: string | null
  estimatedDeliveryAt?: string | null
  trackingEvents?: TrackingEvent[] | null
}

/**
 * Shared component for displaying package tracking information.
 * Shows clickable carrier text and delivery progress bar.
 */
export function TrackingDisplay({
  trackingCarrier,
  trackingStatusLabel,
  trackingStatus,
  trackingUrl,
  estimatedDeliveryAt,
  trackingEvents,
}: TrackingDisplayProps) {
  const estimatedDelivery = estimatedDeliveryAt
    ? new Date(estimatedDeliveryAt)
    : undefined

  return (
    <div className="space-y-2 pt-2">
      <button
        type="button"
        onClick={() => {
          if (trackingUrl) {
            window.open(trackingUrl, "_blank", "noopener,noreferrer")
          }
        }}
        disabled={!trackingUrl}
        className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70 transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground/70"
      >
        {trackingCarrier ?? "Package"} · {trackingStatusLabel ?? "Pending"}
      </button>
      <DeliveryProgress
        stage={mapDeliveryStatus(trackingStatus)}
        estimatedDelivery={estimatedDelivery}
        events={trackingEvents ?? []}
        expandable
      />
    </div>
  )
}
