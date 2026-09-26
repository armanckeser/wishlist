import type { Meta, StoryObj } from "@storybook/react-vite"
import type { GiftedItemPublic } from "@/client"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { Drawer } from "./Drawer"

const meta: Meta<typeof Drawer> = {
  title: "Components/WishlistItem/Owner/Gifted/Drawer",
  component: Drawer,
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
type Story = StoryObj<typeof Drawer>

/**
 * Gifted item with gifter name and message.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.gifted as GiftedItemPublic,
  },
}

/**
 * Anonymous gift - no gifter name shown.
 */
export const Anonymous: Story = {
  args: {
    item: MOCK_ITEMS.giftedAnonymous as GiftedItemPublic,
  },
}

/**
 * Gift with long message.
 */
export const LongMessage: Story = {
  args: {
    item: createMockItem({
      title: "Thoughtful Gift",
      priceCents: 45000,
      imageUrl:
        "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
      status: "gifted",
      gifterDisplayName: "Abed Nadir",
      giftMessage:
        "I saw this and immediately thought of you! It reminded me of that time we went to the vintage market together. I hope it brings you as much joy as that day did. You deserve something special.",
      daysAgo: 3,
    }) as GiftedItemPublic,
  },
}
