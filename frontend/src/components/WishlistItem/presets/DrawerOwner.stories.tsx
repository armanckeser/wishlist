import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { DrawerOwner } from "./DrawerOwner"

const meta: Meta<typeof DrawerOwner> = {
  title: "Components/WishlistItem/DrawerOwner",
  component: DrawerOwner,
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
type Story = StoryObj<typeof DrawerOwner>

/**
 * Default wishlisted item - shows maturity progress and buy button.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.silkDress,
  },
}

/**
 * Most desired item with gold styling.
 */
export const MostDesired: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
  },
}

/**
 * Item in cooling period (recently added).
 */
export const Cooling: Story = {
  args: {
    item: createMockItem({
      title: "Impulse Buy Necklace",
      priceCents: 15000,
      imageUrl:
        "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop",
      daysAgo: 2,
    }),
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
    }),
  },
}

/**
 * Purchased item - shows View on Site + Undo Purchase actions.
 */
export const Purchased: Story = {
  args: {
    item: MOCK_ITEMS.purchased,
  },
}

/**
 * Purchased item where user got a discount.
 */
export const PurchasedWithDiscount: Story = {
  args: {
    item: MOCK_ITEMS.purchasedWithDiscount,
  },
}

/**
 * Purchased item where user paid more than list price.
 */
export const PurchasedOverpaid: Story = {
  args: {
    item: MOCK_ITEMS.purchasedOverpaid,
  },
}

/**
 * Gifted item - shows gift indicator instead of maturity.
 */
export const Gifted: Story = {
  args: {
    item: MOCK_ITEMS.gifted,
  },
}

/**
 * Anonymous gifted item - no gifter name shown.
 */
export const GiftedAnonymous: Story = {
  args: {
    item: MOCK_ITEMS.giftedAnonymous,
  },
}

/**
 * Archived item - grayscale, only View on Site action.
 */
export const Archived: Story = {
  args: {
    item: MOCK_ITEMS.archived,
  },
}

/**
 * Item without image.
 */
export const NoImage: Story = {
  args: {
    item: MOCK_ITEMS.noImage,
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
    }),
  },
}

/**
 * Item with long title to test truncation.
 */
export const LongTitle: Story = {
  args: {
    item: createMockItem({
      title:
        "Extremely Long Product Title That Should Be Truncated When Displayed In The UI Because It Is Just Too Long",
      priceCents: 12500,
      imageUrl:
        "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
      daysAgo: 14,
    }),
  },
}

/**
 * Item with categories.
 */
export const WithCategories: Story = {
  args: {
    item: createMockItem({
      title: "Categorized Ring",
      priceCents: 18500,
      imageUrl:
        "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=500&fit=crop",
      daysAgo: 21,
      categories: [
        {
          id: "1",
          name: "Jewelry",
          parent_id: null,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "2",
          name: "Anniversary",
          parent_id: null,
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
    }),
  },
}
