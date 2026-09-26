import type { WishlistedItemPublic } from "@/client"
import { PriceTrackingSection } from "@/components/PriceTracking/PriceTrackingSection"
import type { WishlistItemPublic } from "@/types"

import type { WishlistItemActions } from "../../../context"
import { useWishlistItem } from "../../../context"
import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { BuyButton } from "../../../drawer/actions/BuyButton"
import { CoolingWarning } from "../../../drawer/actions/CoolingWarning"
import { ReadyActions } from "../../../drawer/actions/ReadyActions"
import { ViewOnSite } from "../../../drawer/actions/ViewOnSite"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { WishlistedInfo } from "../../../drawer/content/WishlistedInfo"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"
import { Menu } from "../../../drawer/primitives/Menu"

interface DrawerProps {
  item: WishlistedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onEdit?: (item: WishlistItemPublic) => void
  onArchive?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
  onBuy?: WishlistItemActions["onBuy"]
}

/**
 * Owner drawer for wishlisted items.
 * Shows maturity progress, buy actions, and full menu.
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onEdit,
  onArchive,
  onDelete,
  onBuy,
}: DrawerProps) {
  return (
    <DrawerRoot
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCloseComplete={onCloseComplete}
      actions={{ onEdit, onArchive, onDelete, onBuy }}
    >
      <Header>
        <Menu />
        <CloseButton />
      </Header>

      <Body>
        <DrawerImage />
        <Details />
        <WishlistedInfo />
        <PriceTrackingSection
          item={item}
          onFixLink={onEdit && (() => onEdit(item))}
          className="mt-5"
        />

        <Footer>
          <CoolingWarning />
          <WishlistedActions />
        </Footer>
      </Body>
    </DrawerRoot>
  )
}

/**
 * Actions for wishlisted items - switches between ready and not-ready layouts.
 */
function WishlistedActions() {
  const { maturity } = useWishlistItem()
  const isReadyToTreat = maturity.state === "ready"

  if (isReadyToTreat) {
    return <ReadyActions />
  }

  return (
    <ActionGroup>
      <ViewOnSite />
      <BuyButton />
    </ActionGroup>
  )
}
