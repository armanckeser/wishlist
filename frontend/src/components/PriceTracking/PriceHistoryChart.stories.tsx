import type { Meta, StoryObj } from "@storybook/react-vite"

import type { PricePointPublic } from "@/client"

import { PriceHistoryChart } from "./PriceHistoryChart"

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function series(
  values: Array<[daysAgo: number, priceCents: number]>,
): PricePointPublic[] {
  return values.map(([d, price], index) => ({
    recorded_at: daysAgo(d),
    price_cents: price,
    source: index === 0 ? "added" : "scheduled",
  }))
}

const meta: Meta<typeof PriceHistoryChart> = {
  title: "Components/PriceTracking/PriceHistoryChart",
  component: PriceHistoryChart,
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
type Story = StoryObj<typeof PriceHistoryChart>

/** A month of daily checks with two markdowns. */
export const PriceDrop: Story = {
  args: {
    currentPriceCents: 14_900,
    points: series([
      [30, 18_500],
      [29, 18_500],
      [27, 18_500],
      [24, 18_500],
      [22, 16_800],
      [20, 16_800],
      [16, 16_800],
      [12, 16_800],
      [9, 14_900],
      [5, 14_900],
      [2, 14_900],
      [1, 14_900],
    ]),
  },
}

/** Sale ended - the price bounced back up. */
export const PriceIncrease: Story = {
  args: {
    currentPriceCents: 21_000,
    points: series([
      [14, 18_500],
      [10, 18_500],
      [7, 15_900],
      [4, 15_900],
      [1, 21_000],
    ]),
  },
}

/** Just added: one reading, flat line to today. */
export const JustAdded: Story = {
  args: {
    currentPriceCents: 6_800,
    points: series([[0, 6_800]]),
  },
}

/** Stable for a long time. */
export const Unchanged: Story = {
  args: {
    currentPriceCents: 9_500,
    points: series([
      [60, 9_500],
      [45, 9_500],
      [30, 9_500],
      [15, 9_500],
      [1, 9_500],
    ]),
  },
}
