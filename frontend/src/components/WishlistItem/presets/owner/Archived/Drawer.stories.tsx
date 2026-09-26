import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ArchivedItemPublic } from "@/client"
import { createMockItem, MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { Drawer } from "./Drawer"

const meta: Meta<typeof Drawer> = {
  title: "Components/WishlistItem/Owner/Archived/Drawer",
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
 * Default archived item - grayscale, shows archive date.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.archived as ArchivedItemPublic,
  },
}

/**
 * Archived item without image.
 */
export const NoImage: Story = {
  args: {
    item: createMockItem({
      title: "Archived Item Without Image",
      priceCents: 9900,
      status: "archived",
      daysAgo: 30,
    }) as ArchivedItemPublic,
  },
}
