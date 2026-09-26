import type { Meta, StoryObj } from "@storybook/react-vite"
import type { WishlistedItemPublic } from "@/client"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { Drawer } from "./Drawer"

const meta: Meta<typeof Drawer> = {
  title: "Components/WishlistItem/Viewer/Wishlisted/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
    onGift: { action: "onGift" },
  },
  args: {
    open: true,
  },
}

export default meta
type Story = StoryObj<typeof Drawer>

/**
 * Viewer sees someone else's wishlisted item with gift action.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.silkDress as WishlistedItemPublic,
  },
}

/**
 * Most desired item - viewer can gift this special item.
 */
export const MostDesired: Story = {
  args: {
    item: MOCK_ITEMS.goldRing as WishlistedItemPublic,
  },
}

/**
 * Expensive item - gift button still available.
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

/**
 * Item without image.
 */
export const NoImage: Story = {
  args: {
    item: MOCK_ITEMS.noImage as WishlistedItemPublic,
  },
}
