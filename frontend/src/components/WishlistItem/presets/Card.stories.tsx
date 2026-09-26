import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fireEvent, fn } from "storybook/test"
import { WishlistGrid } from "@/components/Wishlist/WishlistGrid"
import {
  createMockItem,
  createWishlistDecorator,
  MOCK_ITEMS,
} from "@/storybook"
import { Card } from "./Card"

const meta: Meta<typeof Card> = {
  title: "Components/WishlistItem/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [createWishlistDecorator()],
  argTypes: {
    onClick: { action: "clicked" },
  },
}

export default meta
type Story = StoryObj<typeof Card>

/**
 * Default card with product image, title, price, brand and maturity progress.
 */
export const Default: Story = {
  args: {
    item: MOCK_ITEMS.silkDress,
  },
}

/**
 * Card for the "most desired" item shows a gold ring border.
 */
export const MostDesired: Story = {
  args: {
    item: MOCK_ITEMS.goldRing,
  },
}

/**
 * Card without product image shows placeholder.
 */
export const NoImage: Story = {
  args: {
    item: MOCK_ITEMS.noImage,
  },
}

/**
 * Purchased items don't show maturity progress.
 */
export const Purchased: Story = {
  args: {
    item: MOCK_ITEMS.purchased,
  },
}

/**
 * Purchased at a discount - shows original price struck through with lower paid price.
 */
export const PurchasedWithDiscount: Story = {
  args: {
    item: MOCK_ITEMS.purchasedWithDiscount,
  },
}

/**
 * Purchased at a higher price - only shows the paid price (no strikethrough).
 * We don't want to remind users they overpaid.
 */
export const PurchasedOverpaid: Story = {
  args: {
    item: MOCK_ITEMS.purchasedOverpaid,
  },
}

/**
 * Gifted item shows gift badge and gifter info.
 */
export const Gifted: Story = {
  args: {
    item: MOCK_ITEMS.gifted,
  },
}

/**
 * Gifted item without gifter name (anonymous gift).
 */
export const GiftedAnonymous: Story = {
  args: {
    item: MOCK_ITEMS.giftedAnonymous,
  },
}

/**
 * Archived items appear grayscale with reduced opacity.
 */
export const Archived: Story = {
  args: {
    item: MOCK_ITEMS.archived,
  },
}

/**
 * Card at different maturity stages.
 */
export const MaturityStages: Story = {
  render: () => (
    <WishlistGrid gap={16} minColumnWidth={160}>
      <Card
        item={createMockItem({
          title: "Just Added",
          priceCents: 15000,
          imageUrl:
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop",
          daysAgo: 1,
        })}
      />
      <Card
        item={createMockItem({
          title: "Growing On You",
          priceCents: 15000,
          imageUrl:
            "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop",
          daysAgo: 5,
        })}
      />
      <Card
        item={createMockItem({
          title: "Ready to Treat",
          priceCents: 15000,
          imageUrl:
            "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop",
          daysAgo: 30,
        })}
      />
    </WishlistGrid>
  ),
}

/**
 * Grid of cards showing typical wishlist layout.
 */
export const GridLayout: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <WishlistGrid gap={16} minColumnWidth={160}>
      <Card item={MOCK_ITEMS.goldRing} />
      <Card item={MOCK_ITEMS.silkDress} />
      <Card item={MOCK_ITEMS.designerBag} />
      <Card item={MOCK_ITEMS.pearlEarrings} />
    </WishlistGrid>
  ),
}

/**
 * A finger that scrolls the list must not open the item it started on.
 *
 * Touching a card is how you start scrolling, and iOS Safari still sends a
 * pointerup (and sometimes a click) to the card the finger left. Both the
 * hold that opens selection mode and the tap that opens the drawer have to
 * be called off once the gesture turns into a scroll.
 */
export const ScrollingDoesNotOpenTheItem: Story = {
  args: { item: MOCK_ITEMS.silkDress, onClick: fn() },
  play: async ({ args, canvas, step }) => {
    const card = canvas.getAllByRole("button")[0]

    await step("a tap opens the item", async () => {
      fireEvent.pointerDown(card, { clientX: 40, clientY: 40, button: 0 })
      fireEvent.pointerUp(card, { clientX: 40, clientY: 41, button: 0 })
      fireEvent.click(card, { clientX: 40, clientY: 41 })
      await expect(args.onClick).toHaveBeenCalledTimes(1)
    })

    await step("a scroll that starts on the card does not", async () => {
      fireEvent.pointerDown(card, { clientX: 40, clientY: 200, button: 0 })
      fireEvent.pointerMove(card, { clientX: 42, clientY: 140 })
      fireEvent.pointerUp(card, { clientX: 42, clientY: 140, button: 0 })
      fireEvent.click(card, { clientX: 42, clientY: 140 })
      await expect(args.onClick).toHaveBeenCalledTimes(1)
    })
  },
}
