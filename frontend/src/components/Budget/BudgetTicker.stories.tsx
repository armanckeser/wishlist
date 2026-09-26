import type { Meta, StoryObj } from "@storybook/react-vite"
import { withQueryClient } from "@/storybook"
import { BudgetTicker } from "./BudgetTicker"

const meta = {
  title: "Components/Budget/BudgetTicker",
  component: BudgetTicker,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [withQueryClient],
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "lg"],
    },
  },
} satisfies Meta<typeof BudgetTicker>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Large ticker display (default).
 * Shows loading state without API connection.
 *
 * **Note:** This component requires a backend API connection to display
 * real budget data. In production, it shows:
 * - Real-time updating budget amount (60fps)
 * - Freeze status with countdown when budget is frozen
 * - Gradient text colors: gold (normal), blue (frozen), red (negative)
 */
export const Large: Story = {
  args: {
    size: "lg",
  },
}

/**
 * Small ticker variant for compact displays.
 * Used in sidebar and header contexts.
 */
export const Small: Story = {
  args: {
    size: "sm",
  },
}

/**
 * Both sizes shown side by side.
 */
export const SizeComparison: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Large (lg)</p>
        <BudgetTicker size="lg" />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Small (sm)</p>
        <BudgetTicker size="sm" />
      </div>
    </div>
  ),
}
