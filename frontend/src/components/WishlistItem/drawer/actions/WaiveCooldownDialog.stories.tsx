import type { Meta, StoryObj } from "@storybook/react-vite"
import { WishlistRoleProvider } from "@/contexts/WishlistRoleContext"
import { createMockItem, withWishlistProviders } from "@/storybook"
import { WishlistItemProvider } from "../../context"
import { WaiveCooldownDialog } from "./WaiveCooldownDialog"

const meta: Meta<typeof WaiveCooldownDialog> = {
  title: "Components/WishlistItem/WaiveCooldownDialog",
  component: WaiveCooldownDialog,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
}

export default meta
type Story = StoryObj<typeof WaiveCooldownDialog>

/**
 * Default waive cooldown dialog.
 * Shows for an item that needs a few more days before purchase.
 */
export const Default: Story = {
  decorators: [
    (Story) => (
      <WishlistRoleProvider ownerId="user-1" currentUserId="user-1">
        <WishlistItemProvider
          item={createMockItem({
            title: "Pearl Necklace",
            priceCents: 18500,
            daysAgo: 3, // Only 3 days old, needs 7
          })}
          actions={{}}
        >
          <Story />
        </WishlistItemProvider>
      </WishlistRoleProvider>
    ),
  ],
}

/**
 * Dialog for a recently added expensive item.
 */
export const ExpensiveItemJustAdded: Story = {
  decorators: [
    (Story) => (
      <WishlistRoleProvider ownerId="user-1" currentUserId="user-1">
        <WishlistItemProvider
          item={createMockItem({
            title: "Designer Handbag",
            priceCents: 295000,
            imageUrl:
              "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
            daysAgo: 1, // Just added yesterday
          })}
          actions={{}}
        >
          <Story />
        </WishlistItemProvider>
      </WishlistRoleProvider>
    ),
  ],
}

/**
 * Dialog for a budget item that's almost ready.
 */
export const AlmostReady: Story = {
  decorators: [
    (Story) => (
      <WishlistRoleProvider ownerId="user-1" currentUserId="user-1">
        <WishlistItemProvider
          item={createMockItem({
            title: "Scented Candle",
            priceCents: 3200,
            daysAgo: 6, // 1 day away from ready
          })}
          actions={{}}
        >
          <Story />
        </WishlistItemProvider>
      </WishlistRoleProvider>
    ),
  ],
}
