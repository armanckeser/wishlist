import { ArchiveRestore } from "lucide-react"

import type { ArchivedItemPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { useCooloff } from "@/contexts/CooloffContext"
import type { WishlistItemPublic } from "@/types"

import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { ViewOnSite } from "../../../drawer/actions/ViewOnSite"
import { ArchivedInfo } from "../../../drawer/content/ArchivedInfo"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"
import { Menu } from "../../../drawer/primitives/Menu"

interface DrawerProps {
  item: ArchivedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onDelete?: (item: WishlistItemPublic) => void
  onUnarchive?: (item: WishlistItemPublic) => void
}

/**
 * Owner drawer for archived items.
 * Shows archive date, view action, and unarchive button.
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onDelete,
  onUnarchive,
}: DrawerProps) {
  const { getMaturityInfo } = useCooloff()
  const maturity = getMaturityInfo(item, null)

  return (
    <DrawerRoot
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onCloseComplete={onCloseComplete}
      actions={{ onDelete, onArchive: onUnarchive }}
    >
      <Header>
        <Menu />
        <CloseButton />
      </Header>

      <Body>
        <DrawerImage />
        <Details />
        <ArchivedInfo item={item} daysWishlisted={maturity.daysWishlisted} />

        <Footer>
          <ActionGroup>
            <ViewOnSite />
            <Button
              variant="outline"
              className="h-12 flex-1"
              onClick={() => onUnarchive?.(item)}
            >
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Unarchive
            </Button>
          </ActionGroup>
        </Footer>
      </Body>
    </DrawerRoot>
  )
}
