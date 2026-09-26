import { PriceTrackingSection } from "@/components/PriceTracking/PriceTrackingSection"
import type { WishlistItemPublic } from "@/types"

import type { WishlistItemActions } from "../context"
import { useWishlistItem } from "../context"
import { ActionGroup } from "../drawer/actions/ActionGroup"
import { BuyButton } from "../drawer/actions/BuyButton"
import { CoolingWarning } from "../drawer/actions/CoolingWarning"
import { ReadyActions } from "../drawer/actions/ReadyActions"
import { UndoPurchase } from "../drawer/actions/UndoPurchase"
import { ViewOnSite } from "../drawer/actions/ViewOnSite"
import { Details } from "../drawer/content/Details"
import { DrawerImage } from "../drawer/content/DrawerImage"
import { DrawerMaturity } from "../drawer/content/DrawerMaturity"
import { Body } from "../drawer/primitives/Body"
import { CloseButton } from "../drawer/primitives/CloseButton"
import { DrawerRoot } from "../drawer/primitives/DrawerRoot"
import { Footer } from "../drawer/primitives/Footer"
import { Header } from "../drawer/primitives/Header"
import { Menu } from "../drawer/primitives/Menu"

interface DrawerOwnerProps {
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onEdit?: (item: WishlistItemPublic) => void
  onArchive?: (item: WishlistItemPublic) => void
  onDelete?: (item: WishlistItemPublic) => void
  onBuy?: (item: WishlistItemPublic) => void
}

/**
 * Preset for owner viewing their own wishlist.
 * Shows full edit/archive/delete menu and all purchase actions.
 */
export function DrawerOwner({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onEdit,
  onArchive,
  onDelete,
  onBuy,
}: DrawerOwnerProps) {
  const actions: WishlistItemActions = {
    onEdit,
    onArchive,
    onDelete,
    onBuy,
  }

  return (
    <DrawerRoot
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCloseComplete={onCloseComplete}
      actions={actions}
    >
      <Header>
        <Menu />
        <CloseButton />
      </Header>

      <Body>
        <DrawerImage />
        <Details />
        <DrawerMaturity />
        <OwnerPriceTracking />

        <Footer>
          <CoolingWarning />
          <OwnerActions />
        </Footer>
      </Body>
    </DrawerRoot>
  )
}

/**
 * Price tracking only applies while an item is still wishlisted.
 */
function OwnerPriceTracking() {
  const { item, actions } = useWishlistItem()
  if (item.status !== "wishlisted") return null
  const onEdit = actions.onEdit
  return (
    <PriceTrackingSection
      item={item}
      onFixLink={onEdit && (() => onEdit(item))}
      className="mt-5"
    />
  )
}

/**
 * Internal component that switches between action layouts based on item state.
 * Uses context to determine which actions to show.
 */
function OwnerActions() {
  const { isPurchased, isGifted, isArchived, isReadyToTreat } =
    useWishlistItem()

  // Archived: just View on Site (unarchive via menu)
  if (isArchived) {
    return (
      <ActionGroup>
        <ViewOnSite />
      </ActionGroup>
    )
  }

  // Gifted: just View on Site (can't undo a gift)
  if (isGifted) {
    return (
      <ActionGroup>
        <ViewOnSite />
      </ActionGroup>
    )
  }

  // Ready-to-treat: special two-column layout
  if (!isPurchased && isReadyToTreat) {
    return <ReadyActions />
  }

  // Purchased: View on Site + Undo Purchase
  if (isPurchased) {
    return (
      <ActionGroup>
        <ViewOnSite />
        <UndoPurchase />
      </ActionGroup>
    )
  }

  // Not ready (cooling/growing/saving): View on Site + Mark as Bought
  return (
    <ActionGroup>
      <ViewOnSite />
      <BuyButton />
    </ActionGroup>
  )
}
