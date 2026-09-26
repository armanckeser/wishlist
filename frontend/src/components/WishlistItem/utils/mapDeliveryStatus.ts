import type { DeliveryStatus } from "@/client"
import type { DeliveryStage } from "@/components/Tracking/DeliveryProgress"

/**
 * Map backend DeliveryStatus to frontend DeliveryStage.
 */
export function mapDeliveryStatus(
  status: DeliveryStatus | null | undefined,
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
