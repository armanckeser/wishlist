import type { Meta, StoryObj } from "@storybook/react-vite"
import type { WishlistedItemPublic } from "@/client"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { Drawer } from "./Drawer"

const meta: Meta<typeof Drawer> = {
  title: "Components/WishlistItem/Owner/Wishlisted/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
    onEdit: { action: "onEdit" },
    onArchive: { action: "onArchive" },
    onDelete: { action: "onDelete" },
    onBuy: { action: "onBuy" },
  },
  args: {
    open: true,
  },
}

export default meta
type Story = StoryObj<typeof Drawer>

/**
 * Default wishlisted item - shows maturity progress and buy button.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.silkDress as WishlistedItemPublic,
  },
}

/**
 * Most desired item with gold styling on claim button.
 */
export const MostDesired: Story = {
  args: {
    item: MOCK_ITEMS.goldRing as WishlistedItemPublic,
  },
}

/**
 * Item in cooling period (recently added, needs to wait).
 */
export const Cooling: Story = {
  args: {
    item: createMockItem({
      title: "Impulse Buy Necklace",
      priceCents: 15000,
      imageUrl:
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop",
      daysAgo: 2,
    }) as WishlistedItemPublic,
  },
}

/**
 * Ready to treat item - shows special two-button layout.
 */
export const ReadyToTreat: Story = {
  args: {
    item: createMockItem({
      title: "Patient Purchase Earrings",
      priceCents: 28000,
      imageUrl:
        "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&h=500&fit=crop",
      daysAgo: 35,
    }) as WishlistedItemPublic,
  },
}

/**
 * Item without image.
 */
export const NoImage: Story = {
  args: {
    item: MOCK_ITEMS.noImage as WishlistedItemPublic,
  },
}

/**
 * Expensive item to test price display.
 */
export const ExpensiveItem: Story = {
  args: {
    item: createMockItem({
      title: "Designer Handbag",
      priceCents: 295000,
      imageUrl:
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
      productUrl: "https://www.net-a-porter.com/products/bag",
      daysAgo: 60,
    }) as WishlistedItemPublic,
  },
}
