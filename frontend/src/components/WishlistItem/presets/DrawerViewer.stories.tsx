import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { DrawerViewer } from "./DrawerViewer"

const meta: Meta<typeof DrawerViewer> = {
  title: "Components/WishlistItem/DrawerViewer",
  component: DrawerViewer,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
  },
  args: {
    open: true,
  },
}

export default meta
type Story = StoryObj<typeof DrawerViewer>

/**
 * Viewer seeing a standard wishlisted item.
 * Read-only mode: no menu, only View on Site action.
 * TODO: Add "Gift This" button for viewers.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.silkDress,
  },
}

/**
 * Viewer seeing the most desired item - prime gift candidate!
 */
export const MostDesired: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
  },
}

/**
 * Ready to treat item - owner can buy it, but viewer might want to gift it.
 */
export const ReadyToTreat: Story = {
  args: {
    item: createMockItem({
      title: "Ready For Gifting Bracelet",
      priceCents: 22500,
      imageUrl:
        "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
      daysAgo: 40,
    }),
  },
}

/**
 * Purchased item - viewer sees it was bought.
 */
export const Purchased: Story = {
  args: {
    item: MOCK_ITEMS.purchased,
  },
}

/**
 * Gifted item - viewer sees it was gifted.
 */
export const Gifted: Story = {
  args: {
    item: MOCK_ITEMS.gifted,
  },
}

/**
 * Archived item - viewer sees it's no longer wanted.
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
 * New item in cooling period - viewer sees the owner just added it.
 */
export const Cooling: Story = {
  args: {
    item: createMockItem({
      title: "New Addition Watch",
      priceCents: 45000,
      imageUrl:
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=500&fit=crop",
      daysAgo: 1,
    }),
  },
}

/**
 * Expensive item that a generous viewer might gift.
 */
export const ExpensiveItem: Story = {
  args: {
    item: createMockItem({
      title: "Dream Handbag",
      priceCents: 475000,
      imageUrl:
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
      daysAgo: 90,
    }),
  },
}
