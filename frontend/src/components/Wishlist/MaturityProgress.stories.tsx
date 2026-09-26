import type { Meta, StoryObj } from "@storybook/react-vite"

import { MaturityProgress } from "./MaturityProgress"

const meta: Meta<typeof MaturityProgress> = {
  title: "Components/Wishlist/MaturityProgress",
  component: MaturityProgress,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    progress: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
    },
    state: {
      control: "radio",
      options: ["cooling", "growing", "saving", "ready"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MaturityProgress>

/**
 * Cooling off: 0-50% through cooloff period.
 * Earliest, greyest stage.
 */
export const Cooling: Story = {
  args: {
    progress: 0.25,
    state: "cooling",
  },
}

/**
 * Growing on you: 50-100% through cooloff period.
 * Progressing toward maturity.
 */
export const Growing: Story = {
  args: {
    progress: 0.6,
    state: "growing",
  },
}

/**
 * Saving up: Past cooloff but not yet affordable.
 * High progress, waiting for budget.
 */
export const Saving: Story = {
  args: {
    progress: 0.85,
    state: "saving",
  },
}

/**
 * Ready to treat: Fully mature and affordable.
 * Solid gold bar.
 */
export const Ready: Story = {
  args: {
    progress: 1,
    state: "ready",
  },
}

/**
 * Progression through all states.
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cooling off (25%)</span>
        <MaturityProgress progress={0.25} state="cooling" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Growing on you (60%)
        </span>
        <MaturityProgress progress={0.6} state="growing" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Saving up (85%)</span>
        <MaturityProgress progress={0.85} state="saving" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          Ready to treat (100%)
        </span>
        <MaturityProgress progress={1} state="ready" />
      </div>
    </div>
  ),
}

/**
 * Visual gradient progression from 0% to 100%.
 */
export const ProgressLevels: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((progress) => (
        <div key={progress} className="flex items-center gap-3">
          <span className="w-12 text-right text-xs text-muted-foreground">
            {Math.round(progress * 100)}%
          </span>
          <div className="flex-1">
            <MaturityProgress
              progress={progress}
              state={progress === 1 ? "ready" : "growing"}
            />
          </div>
        </div>
      ))}
    </div>
  ),
}
