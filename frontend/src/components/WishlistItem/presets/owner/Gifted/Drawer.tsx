import { RotateCcw } from "lucide-react"
import { useState } from "react"

import type { GiftedItemPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { UndoDialog } from "@/components/Wishlist/UndoDialog"
import type { WishlistItemPublic } from "@/types"

import { ActionButton } from "../../../drawer/actions/ActionButton"
import { ActionGroup } from "../../../drawer/actions/ActionGroup"
import { Details } from "../../../drawer/content/Details"
import { DrawerImage } from "../../../drawer/content/DrawerImage"
import { GiftedInfo } from "../../../drawer/content/GiftedInfo"
import { Body } from "../../../drawer/primitives/Body"
import { CloseButton } from "../../../drawer/primitives/CloseButton"
import { DrawerRoot } from "../../../drawer/primitives/DrawerRoot"
import { Footer } from "../../../drawer/primitives/Footer"
import { Header } from "../../../drawer/primitives/Header"
import { Menu } from "../../../drawer/primitives/Menu"

interface DrawerProps {
  item: GiftedItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  onEdit?: (item: WishlistItemPublic) => void
}

/**
 * Owner drawer for gifted items.
 * Shows gift info (gifter, message, date), view and undo actions.
 * Supports editing (for adding tracking info).
 */
export function Drawer({
  item,
  open,
  onOpenChange,
  onCloseComplete,
  onEdit,
}: DrawerProps) {
  const [undoDialogOpen, setUndoDialogOpen] = useState(false)

  return (
    <>
      <DrawerRoot
        item={item}
        open={open}
        onOpenChange={onOpenChange}
        onCloseComplete={onCloseComplete}
        actions={{ onEdit }}
      >
        <Header>
          <Menu />
          <CloseButton />
        </Header>

        <Body>
          <DrawerImage />
          <Details />
          <GiftedInfo item={item} />

          <Footer>
            <ActionGroup>
              <ActionButton
                trackingNumber={item.tracking_number}
                trackingStatus={item.tracking_status}
              />
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setUndoDialogOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Undo
              </Button>
            </ActionGroup>
          </Footer>
        </Body>
      </DrawerRoot>

      <UndoDialog
        item={item}
        open={undoDialogOpen}
        onOpenChange={setUndoDialogOpen}
      />
    </>
  )
}
