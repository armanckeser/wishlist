import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GiftSendCelebration } from "./GiftSendCelebration"

const meta: Meta<typeof GiftSendCelebration> = {
  title: "Components/Celebrations/GiftSendCelebration",
  component: GiftSendCelebration,
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
type Story = StoryObj<typeof GiftSendCelebration>

const MOCK_IMAGE_URL =
  "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop"

/**
 * Full send celebration with feel-good stats.
 * Shows how long the recipient has been waiting for this item.
 */
export const FullSendCelebration: Story = {
  render: function FullSendCelebrationStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Elegant celebration with feel-good statistics about how long the
          recipient has been waiting.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          itemTitle="Gold Vermeil Bracelet"
          itemImageUrl={MOCK_IMAGE_URL}
          recipientName="Troy Barnes"
          daysWaited={47}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Send without recipient name.
 */
export const WithoutRecipient: Story = {
  render: function WithoutRecipientStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Send celebration without recipient notification.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          itemTitle="Pearl Earrings"
          itemImageUrl={MOCK_IMAGE_URL}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Send without item image - shows feel-good stats without image.
 */
export const NoImage: Story = {
  render: function NoImageStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Send celebration without product image.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          itemTitle="Gift Card"
          recipientName="Shirley Bennett"
          daysWaited={12}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Single day waited - tests singular grammar.
 */
export const SingleDayWaited: Story = {
  render: function SingleDayWaitedStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Shows "1 day" (singular) correctly.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          itemTitle="Silk Scarf"
          itemImageUrl={MOCK_IMAGE_URL}
          recipientName="Annie Edison"
          daysWaited={1}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Recently added item - no wait time shown.
 */
export const RecentlyAdded: Story = {
  render: function RecentlyAddedStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          No wait time stats when daysWaited is 0 or not provided.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          itemTitle="Cashmere Sweater"
          itemImageUrl={MOCK_IMAGE_URL}
          recipientName="Abed Nadir"
          daysWaited={0}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Minimal - just the core animation.
 */
export const Minimal: Story = {
  render: function MinimalStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Minimal send celebration - no stats, just the core message.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Send Gift
        </Button>
        <GiftSendCelebration
          trigger={trigger}
          onComplete={() => console.log("Send celebration dismissed")}
        />
      </div>
    )
  },
}
