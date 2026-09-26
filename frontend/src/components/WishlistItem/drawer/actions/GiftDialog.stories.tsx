import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMockItem, MOCK_ITEMS } from "@/storybook/mocks"
import { GiftDialog } from "./GiftDialog"

const meta: Meta<typeof GiftDialog> = {
  title: "Components/WishlistItem/GiftDialog",
  component: GiftDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: () => {},
    onConfirm: () => {},
    isPending: false,
  },
}

export default meta
type Story = StoryObj<typeof GiftDialog>

/**
 * Default gift dialog with a standard wishlist item.
 * Shows all optional fields: name, message, and tracking URL.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
  },
}

/**
 * Dialog for gifting an item with an image.
 */
export const WithImage: Story = {
  args: {
    item: createMockItem({
      title: "Pearl Necklace",
      priceCents: 18500,
      imageUrl:
        "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=500&fit=crop",
      productUrl: "https://www.mejuri.com/products/necklace",
      daysAgo: 14,
    }),
  },
}

/**
 * Dialog for gifting an expensive item.
 * Tests large price display.
 */
export const ExpensiveItem: Story = {
  args: {
    item: createMockItem({
      title: "Designer Watch",
      priceCents: 475000,
      imageUrl:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=500&fit=crop",
      productUrl: "https://www.net-a-porter.com/products/watch",
      daysAgo: 60,
    }),
  },
}

/**
 * Dialog for gifting a budget-friendly item.
 */
export const BudgetItem: Story = {
  args: {
    item: createMockItem({
      title: "Scented Candle",
      priceCents: 3200,
      imageUrl:
        "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=400&h=500&fit=crop",
      productUrl: "https://www.nordstrom.com/products/candle",
      daysAgo: 5,
    }),
  },
}

/**
 * Dialog in submitting state with disabled buttons.
 */
export const Submitting: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
    isPending: true,
  },
}

/**
 * Most desired item being gifted.
 * Extra special gift!
 */
export const MostDesiredItem: Story = {
  args: {
    item: createMockItem({
      title: "Dream Handbag",
      priceCents: 295000,
      imageUrl:
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
      productUrl: "https://www.net-a-porter.com/products/bag",
      daysAgo: 90,
      isMostDesired: true,
    }),
  },
}
