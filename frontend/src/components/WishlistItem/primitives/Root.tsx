import type { ReactNode } from "react"

import type { WishlistItemPublic } from "@/types"

import { type WishlistItemActions, WishlistItemProvider } from "../context"

interface RootProps {
  children: ReactNode
  item: WishlistItemPublic
  actions?: WishlistItemActions
  onClose?: () => void
}

/**
 * Root component for WishlistItem compound component.
 * Wraps children in context provider with computed derived state.
 *
 * For drawer usage, pass actions and onClose.
 * For card/row usage, omit actions (selection handled via SelectionContext).
 */
export function Root({ children, item, actions, onClose }: RootProps) {
  return (
    <WishlistItemProvider item={item} actions={actions} onClose={onClose}>
      {children}
    </WishlistItemProvider>
  )
}
