import type { TrackedItemPublic } from "@/client"
import type { WishlistItemPublic } from "@/types"

import { ActionButton } from "../../../drawer/actions/ActionButton"
import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { UndoTracking } from "../../../drawer/actions/UndoTracking"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { TrackingDisplay } from "../../../drawer/content/TrackingDisplay"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"
import { Menu } from "../../../drawer/primitives/Menu"

interface DrawerProps {
  item: TrackedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onEdit?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
}

/**
 * Owner drawer for tracked items.
 * Shows tracking progress, edit and delete actions.
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onEdit,
  onDelete,
}: DrawerProps) {
  return (
    <DrawerRoot
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCloseComplete={onCloseComplete}
      actions={{ onEdit, onDelete }}
    >
      <Header>
        <Menu />
        <CloseButton />
      </Header>

      <Body>
        <DrawerImage />
        <Details />
        <TrackingDisplay
          trackingCarrier={item.tracking_carrier}
          trackingStatusLabel={item.tracking_status_label}
          trackingStatus={item.tracking_status}
          trackingUrl={item.tracking_url}
          estimatedDeliveryAt={item.estimated_delivery_at}
          trackingEvents={item.tracking_events}
        />

        <Footer>
          <ActionGroup>
            <ActionButton
              trackingNumber={item.tracking_number}
              trackingStatus={item.tracking_status}
            />
            <UndoTracking />
          </ActionGroup>
        </Footer>
      </Body>
    </DrawerRoot>
  )
}
