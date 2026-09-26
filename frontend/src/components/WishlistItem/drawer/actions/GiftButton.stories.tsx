import type { Meta, StoryObj } from "@storybook/react-vite"
import { MOCK_ITEMS, withWishlistProviders } from "@/storybook"
import { WishlistItemProvider } from "../../context"
import { GiftButton } from "./GiftButton"

const meta: Meta<typeof GiftButton> = {
  title: "Components/WishlistItem/Actions/GiftButton",
  component: GiftButton,
  tags: ["autodocs"],
  decorators: [withWishlistProviders],
  parameters: {
    layout: "centered",
  },
}

export default meta
type Story = StoryObj<typeof GiftButton>

/**
 * Gift button with onGift action.
 */
export const Default: Story = {
  decorators: [
    (Story) => (
      <WishlistItemProvider
        item={MOCK_ITEMS.silkDress}
        actions={{ onGift: () => {} }}
      >
        <div className="w-48">
          <Story />
        </div>
      </WishlistItemProvider>
    ),
  ],
}

/**
 * Without onGift - button does not render.
 */
export const NoAction: Story = {
  decorators: [
    (Story) => (
      <WishlistItemProvider item={MOCK_ITEMS.silkDress} actions={{}}>
        <div className="w-48 p-4 border border-dashed rounded text-center text-muted-foreground text-sm">
          <Story />
          (Button hidden when no onGift action)
        </div>
      </WishlistItemProvider>
    ),
  ],
}
