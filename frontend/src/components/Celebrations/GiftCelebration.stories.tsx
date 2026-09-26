import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GiftCelebration } from "./GiftCelebration"

const meta: Meta<typeof GiftCelebration> = {
  title: "Components/Celebrations/GiftCelebration",
  component: GiftCelebration,
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
type Story = StoryObj<typeof GiftCelebration>

const MOCK_IMAGE_URL =
  "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop"

/**
 * Full gift celebration flow.
 * 1. Blurred image + "A gift for you" appears
 * 2. Tap to reveal - image de-blurs, details fade in
 * 3. Tap to dismiss
 */
export const FullGiftCelebration: Story = {
  render: function FullGiftCelebrationStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Blurred image teases the gift. Tap to reveal and see the details.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Gift Celebration
        </Button>
        <GiftCelebration
          trigger={trigger}
          itemTitle="Gold Vermeil Bracelet"
          itemImageUrl={MOCK_IMAGE_URL}
          gifterName="Troy Barnes"
          giftMessage="Happy birthday! Hope you love it."
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Gift celebration with just the essentials - no message.
 */
export const GiftWithoutMessage: Story = {
  render: function GiftWithoutMessageStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Gift celebration without a personal message.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Gift Celebration
        </Button>
        <GiftCelebration
          trigger={trigger}
          itemTitle="Pearl Earrings"
          itemImageUrl={MOCK_IMAGE_URL}
          gifterName="Abed Nadir"
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Anonymous gift - no gifter name shown.
 */
export const AnonymousGift: Story = {
  render: function AnonymousGiftStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Anonymous gift - gifter chose not to reveal their identity.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Anonymous Gift
        </Button>
        <GiftCelebration
          trigger={trigger}
          itemTitle="Mystery Perfume"
          itemImageUrl="https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=500&fit=crop"
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Gift celebration without image - text only flow.
 */
export const NoImage: Story = {
  render: function NoImageStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Gift celebration without product image. Timing adjusts accordingly.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger No Image Gift
        </Button>
        <GiftCelebration
          trigger={trigger}
          itemTitle="Gift Card"
          gifterName="Annie Edison"
          giftMessage="Get yourself something nice!"
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Minimal gift celebration - just the headline.
 */
export const MinimalGift: Story = {
  render: function MinimalGiftStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Minimal gift celebration with just the core animation.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Minimal Gift
        </Button>
        <GiftCelebration
          trigger={trigger}
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}

/**
 * Gift with long heartfelt message.
 */
export const LongMessage: Story = {
  render: function LongMessageStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Gift with a longer, heartfelt message from the gifter.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Gift with Long Message
        </Button>
        <GiftCelebration
          trigger={trigger}
          itemTitle="Cashmere Scarf"
          itemImageUrl="https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=500&fit=crop"
          gifterName="Shirley Bennett"
          giftMessage="I saw this and immediately thought of you. You've been such a wonderful friend, and I wanted to give you something special. Stay warm this winter!"
          onComplete={() => console.log("Gift celebration dismissed")}
        />
      </div>
    )
  },
}
