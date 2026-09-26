import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PurchaseCelebration } from "./PurchaseCelebration"

const meta: Meta<typeof PurchaseCelebration> = {
  title: "Components/Celebrations/PurchaseCelebration",
  component: PurchaseCelebration,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      story: {
        inline: false,
        iframeHeight: 600,
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof PurchaseCelebration>

const MOCK_IMAGE_URL =
  "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&h=500&fit=crop"

/**
 * Standard purchase celebration for a regular item.
 * Shows image, "Yours", item name, and days waited.
 */
export const StandardPurchase: Story = {
  render: function StandardPurchaseStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Standard purchase celebration. Click the button to trigger, then tap
          anywhere to dismiss.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Celebration
        </Button>
        <PurchaseCelebration
          trigger={trigger}
          itemTitle="Silk Dress"
          itemImageUrl={MOCK_IMAGE_URL}
          daysWaited={12}
          isMostDesired={false}
          onComplete={() => console.log("Celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Most desired item celebration with extra gold effects.
 * Shows "Well Deserved!" message and more gold particles.
 */
export const MostDesiredPurchase: Story = {
  render: function MostDesiredPurchaseStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Celebration for the Most Desired item. Extra gold effects, gold ring
          around image, and "Well Deserved!" message.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Most Desired Celebration
        </Button>
        <PurchaseCelebration
          trigger={trigger}
          itemTitle="Gold Vermeil Ring"
          itemImageUrl={MOCK_IMAGE_URL}
          daysWaited={32}
          isMostDesired={true}
          onComplete={() => console.log("Celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Celebration without image - text only.
 */
export const NoImage: Story = {
  render: function NoImageStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Celebration without product image. Sequence adjusts timing.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Celebration
        </Button>
        <PurchaseCelebration
          trigger={trigger}
          itemTitle="Designer Handbag"
          daysWaited={45}
          isMostDesired={false}
          onComplete={() => console.log("Celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Minimal celebration - no optional props.
 */
export const MinimalCelebration: Story = {
  render: function MinimalCelebrationStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Minimal celebration with just the "Yours" headline.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Minimal
        </Button>
        <PurchaseCelebration
          trigger={trigger}
          onComplete={() => console.log("Celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Long wait celebration - waited 100+ days.
 */
export const LongWait: Story = {
  render: function LongWaitStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Celebration for an item waited a very long time.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Long Wait Celebration
        </Button>
        <PurchaseCelebration
          trigger={trigger}
          itemTitle="Limited Edition Watch"
          itemImageUrl={MOCK_IMAGE_URL}
          daysWaited={127}
          isMostDesired={true}
          onComplete={() => console.log("Celebration dismissed")}
        />
      </div>
    )
  },
}
