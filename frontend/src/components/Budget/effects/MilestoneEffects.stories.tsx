import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MilestoneEffects, type MilestoneLevel } from "./MilestoneEffects"

const meta: Meta<typeof MilestoneEffects> = {
  title: "Components/Budget/Effects/MilestoneEffects",
  component: MilestoneEffects,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
}

export default meta
type Story = StoryObj<typeof MilestoneEffects>

const MILESTONE_TIERS: {
  level: MilestoneLevel
  label: string
  desc: string
}[] = [
  { level: "tenthCent", label: "$0.001", desc: "1 sparkle" },
  { level: "cent", label: "$0.01", desc: "2 sparkles" },
  { level: "dime", label: "$0.10", desc: "3 sparkles" },
  { level: "dollar", label: "$1", desc: "Shimmer sweep" },
  { level: "tenDollar", label: "$10", desc: "Shimmer + ring" },
  { level: "hundredDollar", label: "$100", desc: "Full celebration" },
]

/**
 * Interactive playground to test all milestone effects.
 * Click a tier button to trigger its animation.
 */
export const AllTiers: Story = {
  render: function AllTiersStory() {
    const [activeLevel, setActiveLevel] = useState<MilestoneLevel | null>(null)
    const [trigger, setTrigger] = useState(0)

    const handleTrigger = (level: MilestoneLevel) => {
      setActiveLevel(level)
      setTrigger((t) => t + 1)
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="relative flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-background">
          <MilestoneEffects level={activeLevel} trigger={trigger} />
          <span className="font-display text-5xl font-light text-foreground">
            $1,234.56
          </span>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {MILESTONE_TIERS.map((tier) => (
            <Button
              key={tier.level}
              variant="outline"
              size="sm"
              onClick={() => handleTrigger(tier.level)}
              className="flex flex-col h-auto py-2"
            >
              <span className="font-medium">{tier.label}</span>
              <span className="text-xs text-muted-foreground">{tier.desc}</span>
            </Button>
          ))}
        </div>
      </div>
    )
  },
}

/**
 * Tenth cent - single tiny sparkle (most frequent).
 */
export const TenthCent: Story = {
  render: function TenthCentStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col gap-4">
        <div className="relative flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
          <MilestoneEffects level="tenthCent" trigger={trigger} />
          <span className="font-display text-4xl font-light">$0.001</span>
        </div>
        <Button onClick={() => setTrigger((t) => t + 1)}>Trigger Effect</Button>
      </div>
    )
  },
}

/**
 * Cent - 2 sparkles.
 */
export const Cent: Story = {
  render: function CentStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col gap-4">
        <div className="relative flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
          <MilestoneEffects level="cent" trigger={trigger} />
          <span className="font-display text-4xl font-light">$0.01</span>
        </div>
        <Button onClick={() => setTrigger((t) => t + 1)}>Trigger Effect</Button>
      </div>
    )
  },
}

/**
 * Dollar - shimmer sweep across number.
 */
export const Dollar: Story = {
  render: function DollarStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col gap-4">
        <div className="relative flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
          <MilestoneEffects level="dollar" trigger={trigger} />
          <span className="font-display text-4xl font-light">$1.00</span>
        </div>
        <Button onClick={() => setTrigger((t) => t + 1)}>Trigger Effect</Button>
      </div>
    )
  },
}

/**
 * Hundred dollar - full celebration burst with particles.
 */
export const HundredDollar: Story = {
  render: function HundredDollarStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col gap-4">
        <div className="relative flex h-32 items-center justify-center rounded-lg border border-dashed border-border">
          <MilestoneEffects level="hundredDollar" trigger={trigger} />
          <span className="font-display text-5xl font-light">$100</span>
        </div>
        <Button onClick={() => setTrigger((t) => t + 1)}>
          Trigger Celebration
        </Button>
      </div>
    )
  },
}
