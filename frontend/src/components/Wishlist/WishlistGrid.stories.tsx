import type { Meta, StoryObj } from "@storybook/react-vite"
import { Card } from "@/components/WishlistItem/presets/Card"
import {
  createWishlistDecorator,
  MOCK_ITEMS,
  MOCK_WISHLIST_ITEMS,
} from "@/storybook"
import { WishlistGrid } from "./WishlistGrid"

const meta: Meta<typeof WishlistGrid> = {
  title: "Components/Wishlist/WishlistGrid",
  component: WishlistGrid,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [createWishlistDecorator()],
  argTypes: {
    gap: {
      control: { type: "range", min: 4, max: 32, step: 4 },
    },
    minColumnWidth: {
      control: { type: "range", min: 100, max: 300, step: 20 },
    },
  },
}

export default meta
type Story = StoryObj<typeof WishlistGrid>

/** Placeholder card for grid demos */
function PlaceholderCard({ index }: { index: number }) {
  return (
    <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
      Card {index + 1}
    </div>
  )
}

/**
 * Default grid showing actual wishlist item cards.
 */
export const Default: Story = {
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
 * Grid with many items to show responsive column behavior.
 */
export const ManyItems: Story = {
  render: () => (
    <WishlistGrid gap={16} minColumnWidth={160}>
      {MOCK_WISHLIST_ITEMS.map((item) => (
        <Card key={item.id} item={item} />
      ))}
      {MOCK_WISHLIST_ITEMS.map((item) => (
        <Card key={`${item.id}-2`} item={{ ...item, id: `${item.id}-2` }} />
      ))}
    </WishlistGrid>
  ),
}

/**
 * Narrow columns for dense displays.
 */
export const NarrowColumns: Story = {
  render: () => (
    <WishlistGrid gap={8} minColumnWidth={120}>
      <Card item={MOCK_ITEMS.goldRing} />
      <Card item={MOCK_ITEMS.silkDress} />
      <Card item={MOCK_ITEMS.designerBag} />
      <Card item={MOCK_ITEMS.pearlEarrings} />
      <Card item={MOCK_ITEMS.noImage} />
      <Card item={MOCK_ITEMS.purchased} />
    </WishlistGrid>
  ),
}

/**
 * Wide columns for larger card displays.
 */
export const WideColumns: Story = {
  render: () => (
    <WishlistGrid gap={24} minColumnWidth={240}>
      <Card item={MOCK_ITEMS.goldRing} />
      <Card item={MOCK_ITEMS.silkDress} />
      <Card item={MOCK_ITEMS.designerBag} />
      <Card item={MOCK_ITEMS.pearlEarrings} />
    </WishlistGrid>
  ),
}

/**
 * Comparison of different gap sizes using placeholder cards.
 */
export const GapComparison: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Gap: 8px</p>
        <WishlistGrid gap={8} minColumnWidth={120}>
          {Array.from({ length: 4 }, (_, i) => (
            <PlaceholderCard key={i} index={i} />
          ))}
        </WishlistGrid>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Gap: 16px (default)
        </p>
        <WishlistGrid gap={16} minColumnWidth={120}>
          {Array.from({ length: 4 }, (_, i) => (
            <PlaceholderCard key={i} index={i} />
          ))}
        </WishlistGrid>
      </div>
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Gap: 24px</p>
        <WishlistGrid gap={24} minColumnWidth={120}>
          {Array.from({ length: 4 }, (_, i) => (
            <PlaceholderCard key={i} index={i} />
          ))}
        </WishlistGrid>
      </div>
    </div>
  ),
}
