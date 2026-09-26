import type { DeliveryStatus } from "@/client"

import { ViewOnSite } from "./ViewOnSite"
import { ViewTracking } from "./ViewTracking"

interface ActionButtonProps {
  trackingNumber?: string | null
  trackingStatus?: DeliveryStatus | null
  className?: string
}

/**
 * Smart action button that shows either "View Tracking" or "View on Site"
 * based on whether the item has active tracking.
 *
 * Logic: Show "View Tracking" if item has tracking and is not yet delivered.
 * Otherwise show "View on Site".
 */
export function ActionButton({
  trackingNumber,
  trackingStatus,
  className,
}: ActionButtonProps) {
  const hasActiveTracking = trackingNumber && trackingStatus !== "delivered"

  if (hasActiveTracking) {
    return <ViewTracking className={className} />
  }

  return <ViewOnSite className={className} />
}
