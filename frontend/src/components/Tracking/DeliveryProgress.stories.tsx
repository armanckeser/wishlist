import type { Meta, StoryObj } from "@storybook/react"
import {
  DeliveryProgressMilestones,
  type DeliveryStage,
} from "./DeliveryProgress"

const meta: Meta<typeof DeliveryProgressMilestones> = {
  title: "Tracking/DeliveryProgress",
  component: DeliveryProgressMilestones,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-md p-4">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DeliveryProgressMilestones>

// Helper to create date X days from now
const daysFromNow = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export const LabelCreated: Story = {
  name: "Label Created",
  render: () => (
    <DeliveryProgressMilestones
      stage="label_created"
      estimatedDelivery={daysFromNow(5)}
    />
  ),
}

export const InTransit: Story = {
  name: "In Transit",
  render: () => (
    <DeliveryProgressMilestones
      stage="in_transit"
      estimatedDelivery={daysFromNow(3)}
    />
  ),
}

export const OutForDelivery: Story = {
  name: "Out for Delivery",
  render: () => (
    <DeliveryProgressMilestones
      stage="out_for_delivery"
      estimatedDelivery={daysFromNow(0)}
    />
  ),
}

export const Delivered: Story = {
  name: "Delivered",
  render: () => <DeliveryProgressMilestones stage="delivered" />,
}

export const Exception: Story = {
  name: "Exception/Alert",
  render: () => <DeliveryProgressMilestones stage="exception" />,
}

export const AllStages: Story = {
  name: "All Stages",
  render: () => {
    const stages: DeliveryStage[] = [
      "label_created",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ]

    return (
      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage}>
            <span className="mb-1 block text-xs text-muted-foreground capitalize">
              {stage.replace("_", " ")}
            </span>
            <DeliveryProgressMilestones
              stage={stage}
              estimatedDelivery={
                stage !== "delivered"
                  ? daysFromNow(5 - stages.indexOf(stage))
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    )
  },
}
