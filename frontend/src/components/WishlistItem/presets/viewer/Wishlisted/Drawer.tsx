import type { WishlistedItemPublic } from "@/client"
import type { WishlistItemPublic } from "@/types"

import type { GiftOptions } from "../../../context"
import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { GiftButton } from "../../../drawer/actions/GiftButton"
import { ViewOnSite } from "../../../drawer/actions/ViewOnSite"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"

interface DrawerProps {
  item: WishlistedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onGift?: (item: WishlistItemPublic, options?: GiftOptions) => void
}

/**
 * Viewer drawer for wishlisted items on someone else's wishlist.
 * Shows product details with gift action.
 * No menu or maturity info - that's owner-only.
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onGift,
}: DrawerProps) {
  return (
    <DrawerRoot
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCloseComplete={onCloseComplete}
      actions={{ onGift }}
    >
      <Header>
        <CloseButton />
      </Header>

      <Body>
        <DrawerImage />
        <Details />

        <Footer>
          <ActionGroup>
            <ViewOnSite />
            <GiftButton />
          </ActionGroup>
        </Footer>
      </Body>
    </DrawerRoot>
  )
}
