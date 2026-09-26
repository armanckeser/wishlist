import type { PurchasedItemPublic } from "@/client"
import { useCooloff } from "@/contexts/CooloffContext"
import type { WishlistItemPublic } from "@/types"

import { ActionButton } from "../../../drawer/actions/ActionButton"
import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { UndoPurchase } from "../../../drawer/actions/UndoPurchase"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { PurchasedInfo } from "../../../drawer/content/PurchasedInfo"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"
import { Menu } from "../../../drawer/primitives/Menu"

interface DrawerProps {
  item: PurchasedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onEdit?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
}

/**
 * Owner drawer for purchased items.
 * Shows purchase date and undo action.
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onEdit,
  onDelete,
}: DrawerProps) {
  const { getMaturityInfo } = useCooloff()
  const maturity = getMaturityInfo(item, null)

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
        <PurchasedInfo item={item} daysWishlisted={maturity.daysWishlisted} />

        <Footer>
          <ActionGroup>
            <ActionButton
              trackingNumber={item.tracking_number}
              trackingStatus={item.tracking_status}
            />
            <UndoPurchase />
          </ActionGroup>
        </Footer>
      </Body>
    </DrawerRoot>
  )
}
