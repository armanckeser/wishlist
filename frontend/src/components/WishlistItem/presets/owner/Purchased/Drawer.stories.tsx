import type { Meta, StoryObj } from "@storybook/react-vite"
import type { PurchasedItemPublic } from "@/client"
import { MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { Drawer } from "./Drawer"

const meta: Meta<typeof Drawer> = {
  title: "Components/WishlistItem/Owner/Purchased/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
    onDelete: { action: "onDelete" },
  },
  args: {
    open: true,
  },
}

export default meta
type Story = StoryObj<typeof Drawer>

/**
 * Default purchased item - shows purchase date and undo action.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.purchased as PurchasedItemPublic,
  },
}

/**
 * Purchased with discount - paid less than list price.
 */
export const WithDiscount: Story = {
  args: {
    item: MOCK_ITEMS.purchasedWithDiscount as PurchasedItemPublic,
  },
}

/**
 * Purchased at full price.
 */
export const FullPrice: Story = {
  args: {
    item: MOCK_ITEMS.purchasedFullPrice as PurchasedItemPublic,
  },
}

/**
 * Purchased at higher price (resale, etc.) - shows what they paid.
 */
export const Overpaid: Story = {
  args: {
    item: MOCK_ITEMS.purchasedOverpaid as PurchasedItemPublic,
  },
}
