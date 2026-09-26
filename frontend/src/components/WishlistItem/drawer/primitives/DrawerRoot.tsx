import { type ReactNode, useEffect, useState } from "react"

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import type { WishlistItemPublic } from "@/types"

import { type WishlistItemActions, WishlistItemProvider } from "../../context"

interface DrawerRootProps {
  children: ReactNode
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseComplete?: () => void
  actions?: WishlistItemActions
}

/**
 * Root component for drawer preset.
 * Wraps Vaul drawer and provides WishlistItem context to children.
 * Keeps item stable during close animation to prevent content flash.
 */
export function DrawerRoot({
  children,
  item,
  open,
  onOpenChange,
  onCloseComplete,
  actions = {},
}: DrawerRootProps) {
  // Keep item stable during close animation - only update when we have a new item
  const [stableItem, setStableItem] = useState<WishlistItemPublic | null>(item)

  useEffect(() => {
    if (item) {
      setStableItem(item)
    }
    // Don't clear when item becomes null - wait for animation to complete
  }, [item])

  const handleAnimationEnd = (isOpen: boolean) => {
    if (!isOpen) {
      setStableItem(null)
      onCloseComplete?.()
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      onAnimationEnd={handleAnimationEnd}
    >
      <DrawerContent className="max-h-[85dvh]">
        <DrawerTitle className="sr-only">
          {stableItem?.title ?? "Item"} details
        </DrawerTitle>

        {stableItem && (
          <WishlistItemProvider
            item={stableItem}
            actions={actions}
            onClose={handleClose}
          >
            {children}
          </WishlistItemProvider>
        )}
      </DrawerContent>
    </Drawer>
  )
}
