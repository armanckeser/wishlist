import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { PriceHistoryPublic, WishlistedItemPublic } from "@/client"
import { createMockItem } from "@/storybook"

import { PriceTrackingSection } from "./PriceTrackingSection"

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function wishlisted(
  overrides: Parameters<typeof createMockItem>[0] = {},
): WishlistedItemPublic {
  const item = createMockItem({
    title: "Silk slip dress",
    productUrl: "https://www.example.com/products/silk-slip-dress",
    ...overrides,
  })
  if (item.status !== "wishlisted") throw new Error("expected wishlisted")
  return item
}

/** Seeds the history cache so the tracking state renders without a backend. */
function withHistory(item: WishlistedItemPublic, history: PriceHistoryPublic) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(["price-history", item.id], history)
  return (Story: React.ComponentType) => (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  )
}

const emptyClient = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
})

const meta: Meta<typeof PriceTrackingSection> = {
  title: "Components/PriceTracking/PriceTrackingSection",
  component: PriceTrackingSection,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof PriceTrackingSection>

const droppedItem = wishlisted({
  priceCents: 14_900,
  daysAgo: 30,
  priceTracking: {
    last_checked_at: daysAgo(0),
    original_price_cents: 18_500,
    lowest_price_cents: 14_900,
    previous_price_cents: 16_800,
    price_changed_at: daysAgo(9),
  },
})

/** Tracking, price has dropped twice since the item was added. */
export const Tracking: Story = {
  args: { item: droppedItem },
  decorators: [
    withHistory(droppedItem, {
      item_id: droppedItem.id,
      current_price_cents: 14_900,
      tracking: droppedItem.price_tracking!,
      points: [
        { recorded_at: daysAgo(30), price_cents: 18_500, source: "added" },
        { recorded_at: daysAgo(27), price_cents: 18_500, source: "scheduled" },
        { recorded_at: daysAgo(22), price_cents: 16_800, source: "scheduled" },
        { recorded_at: daysAgo(16), price_cents: 16_800, source: "scheduled" },
        { recorded_at: daysAgo(9), price_cents: 14_900, source: "scheduled" },
        { recorded_at: daysAgo(2), price_cents: 14_900, source: "scheduled" },
      ],
    }),
  ],
}

const failingItem = wishlisted({
  priceCents: 9_500,
  daysAgo: 12,
  priceTracking: {
    last_checked_at: daysAgo(0),
    original_price_cents: 9_500,
    lowest_price_cents: 9_500,
    consecutive_failures: 2,
    last_error: "The store blocked the check.",
    last_error_reason: "blocked",
  },
})

/** Tracking, but the last two daily checks failed. */
export const RecentFailure: Story = {
  args: { item: failingItem },
  decorators: [
    withHistory(failingItem, {
      item_id: failingItem.id,
      current_price_cents: 9_500,
      tracking: failingItem.price_tracking!,
      points: [
        { recorded_at: daysAgo(12), price_cents: 9_500, source: "initial" },
        { recorded_at: daysAgo(5), price_cents: 9_500, source: "scheduled" },
      ],
    }),
  ],
}

/** Item added by hand - the page has never been parsed, so we offer to try. */
export const NotYetTracked: Story = {
  args: {
    item: wishlisted({
      priceTracking: undefined,
    }),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/** Tracking paused after five failed checks. */
export const Paused: Story = {
  args: {
    item: wishlisted({
      priceTracking: {
        enabled: false,
        paused: true,
        consecutive_failures: 5,
        last_error: "Couldn't reach the store.",
        last_error_reason: "unreachable",
        original_price_cents: 18_500,
      },
    }),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/**
 * A price that was already wrong when identity checking arrived: the item
 * still carries it, so the drawer offers to take the added price back.
 */
export const PriceLooksWrong: Story = {
  args: {
    item: wishlisted({
      priceCents: 1_200,
      priceTracking: {
        enabled: true,
        last_checked_at: daysAgo(0),
        original_price_cents: 18_500,
        lowest_price_cents: 1_200,
      },
    }),
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/**
 * The link now redirects somewhere else, so the price on it isn't this
 * item's. Nothing is overwritten - the item asks for a new link instead.
 */
export const LinkMoved: Story = {
  args: {
    item: wishlisted({
      priceTracking: {
        enabled: false,
        paused: true,
        consecutive_failures: 3,
        last_error: "The link now opens a different page.",
        last_error_reason: "link_moved",
        original_price_cents: 18_500,
      },
    }),
    onFixLink: () => {},
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

/** No product link - nothing to check. */
export const NoLink: Story = {
  args: { item: wishlisted({ productUrl: null }) },
  decorators: [
    (Story) => (
      <QueryClientProvider client={emptyClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
