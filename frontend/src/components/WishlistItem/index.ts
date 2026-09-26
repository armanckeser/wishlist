/**
 * WishlistItem - Unified compound component for displaying wishlist items.
 *
 * Usage with presets (recommended):
 * ```tsx
 * // Grid card layout
 * <WishlistItem.Card item={item} onClick={handleClick} />
 *
 * // List row layout
 * <WishlistItem.Row item={item} onClick={handleClick} />
 *
 * // Detail drawer (owner)
 * <WishlistItem.DrawerOwner
 *   item={item}
 *   open={open}
 *   onOpenChange={setOpen}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onBuy={handleBuy}
 * />
 *
 * // Detail drawer (viewer)
 * <WishlistItem.DrawerViewer
 *   item={item}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 * ```
 *
 * Usage with composition (for custom layouts):
 * ```tsx
 * <WishlistItem.Root item={item}>
 *   <WishlistItem.Image size="card" />
 *   <WishlistItem.Title />
 *   <WishlistItem.Price />
 *   <WishlistItem.Brand />
 *   <WishlistItem.Categories />
 *   <WishlistItem.Maturity />
 * </WishlistItem.Root>
 * ```
 */

// Context and hook
export { useWishlistItem, type WishlistItemActions } from "./context"
// Drawer components (for custom drawer composition)
export * from "./drawer"

// Presets
export {
  Card,
  DrawerOwner,
  DrawerViewer,
  HorizontalCard,
  ItemDrawer,
  Row,
} from "./presets"
// Status-specific presets
export * as Owner from "./presets/owner"
export * as Viewer from "./presets/viewer"
// Primitives
export {
  Brand,
  Categories,
  Image,
  Maturity,
  Price,
  Root,
  SelectionCheckbox,
  Title,
} from "./primitives"

// Utils
export * from "./utils"

import {
  ActionGroup,
  Body,
  BuyButton,
  CloseButton,
  CoolingWarning,
  Details,
  DrawerImage,
  DrawerMaturity,
  DrawerRoot,
  Footer,
  Header,
  KeepSaving,
  Menu,
  ReadyActions,
  UndoPurchase,
  ViewOnSite,
} from "./drawer"
// Re-export as namespace for dot notation usage
import { Card } from "./presets/Card"
import { DrawerOwner } from "./presets/DrawerOwner"
import { DrawerViewer } from "./presets/DrawerViewer"
import { HorizontalCard } from "./presets/HorizontalCard"
import { ItemDrawer } from "./presets/ItemDrawer"
import * as Owner from "./presets/owner"
import { Row } from "./presets/Row"
import * as Viewer from "./presets/viewer"
import { Brand } from "./primitives/Brand"
import { Categories } from "./primitives/Categories"
import { Image } from "./primitives/Image"
import { Maturity } from "./primitives/Maturity"
import { Price } from "./primitives/Price"
import { Root } from "./primitives/Root"
import { SelectionCheckbox } from "./primitives/SelectionCheckbox"
import { Title } from "./primitives/Title"

export const WishlistItem = {
  // Primitives (shared)
  Root,
  Image,
  Title,
  Price,
  Brand,
  Categories,
  Maturity,
  SelectionCheckbox,
  // Presets
  Card,
  HorizontalCard,
  Row,
  DrawerOwner,
  DrawerViewer,
  ItemDrawer,
  // Status-specific presets by role
  Owner,
  Viewer,
  // Drawer primitives (for custom composition)
  DrawerRoot,
  Header,
  Body,
  Footer,
  CloseButton,
  Menu,
  // Drawer content
  DrawerImage,
  Details,
  DrawerMaturity,
  // Drawer actions
  ViewOnSite,
  BuyButton,
  UndoPurchase,
  CoolingWarning,
  KeepSaving,
  ActionGroup,
  ReadyActions,
}
