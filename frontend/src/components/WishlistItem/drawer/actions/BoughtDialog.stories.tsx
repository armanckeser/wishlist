import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMockItem, MOCK_ITEMS } from "@/storybook/mocks"
import { BoughtDialog } from "./BoughtDialog"

const meta: Meta<typeof BoughtDialog> = {
  title: "Components/WishlistItem/BoughtDialog",
  component: BoughtDialog,
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
type Story = StoryObj<typeof BoughtDialog>

/**
 * Default dialog with a standard item.
 * Shows pre-filled price and optional fields.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
  },
}

/**
 * Dialog with an item that has an image.
 */
export const WithImage: Story = {
  args: {
    item: createMockItem({
      title: "Silk Scarf",
      priceCents: 12500,
      imageUrl:
        "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=500&fit=crop",
      productUrl: "https://www.reformation.com/products/scarf",
      daysAgo: 21,
    }),
  },
}

/**
 * Dialog with an item that has no image.
 */
export const NoImage: Story = {
  args: {
    item: createMockItem({
      title: "Gift Card",
      priceCents: 5000,
      imageUrl: null,
      daysAgo: 3,
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
 * Dialog for an expensive item to test large price display.
 */
export const ExpensiveItem: Story = {
  args: {
    item: createMockItem({
      title: "Designer Handbag",
      priceCents: 245000,
      imageUrl:
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
      productUrl: "https://www.net-a-porter.com/products/bag",
      daysAgo: 45,
    }),
  },
}

/**
 * Dialog for a budget-friendly item.
 */
export const BudgetItem: Story = {
  args: {
    item: createMockItem({
      title: "Lipstick",
      priceCents: 2400,
      imageUrl:
        "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400&h=500&fit=crop",
      productUrl: "https://www.sephora.com/products/lipstick",
      daysAgo: 7,
    }),
  },
}
