import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Celebration } from "./Celebration"

const meta: Meta<typeof Celebration> = {
  title: "Components/Celebrations/Celebration (Base)",
  component: Celebration,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Base Celebration component with composable sub-components.
Use this to create custom celebrations with consistent styling.

**Available sub-components:**
- \`Celebration.Image\` - Product image with optional blur, ring, shimmer
- \`Celebration.Headline\` - Main headline (supports gold gradient)
- \`Celebration.Text\` - Body text with variants
- \`Celebration.Hint\` - "tap to continue" hint
- \`Celebration.Particles\` - Floating gold particles
        `,
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof Celebration>

const MOCK_IMAGE_URL =
  "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=500&fit=crop"

/**
 * Basic custom celebration showing composition pattern.
 */
export const CustomCelebration: Story = {
  render: function CustomCelebrationStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Example of composing a custom celebration using the base components.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger Celebration
        </Button>
        <Celebration
          trigger={trigger}
          onComplete={() => console.log("Custom celebration dismissed")}
        >
          <Celebration.Image src={MOCK_IMAGE_URL} alt="Product" />
          <Celebration.Headline gold>Custom Title</Celebration.Headline>
          <Celebration.Text variant="title">Subtitle Text</Celebration.Text>
          <Celebration.Text delay={0.8}>
            Additional context or message here.
          </Celebration.Text>
          <Celebration.Hint />
          <Celebration.Particles count={8} />
        </Celebration>
      </div>
    )
  },
}

/**
 * Minimal celebration with just text.
 */
export const MinimalTextOnly: Story = {
  render: function MinimalTextOnlyStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Minimal celebration with just headline and hint.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger
        </Button>
        <Celebration trigger={trigger}>
          <Celebration.Headline>Success!</Celebration.Headline>
          <Celebration.Text delay={0.5}>
            Your action was completed.
          </Celebration.Text>
          <Celebration.Hint delay={1.0} />
        </Celebration>
      </div>
    )
  },
}

/**
 * With gold styling and particles for special moments.
 */
export const GoldCelebration: Story = {
  render: function GoldCelebrationStory() {
    const [trigger, setTrigger] = useState(0)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Gold styling with particles for milestone moments.
        </p>
        <Button onClick={() => setTrigger((t) => t + 1)} size="lg">
          Trigger
        </Button>
        <Celebration trigger={trigger}>
          <Celebration.Image
            src={MOCK_IMAGE_URL}
            ring
            shimmer
            alt="Achievement"
          />
          <Celebration.Headline gold>
            Achievement Unlocked!
          </Celebration.Headline>
          <Celebration.Text
            delay={0.6}
            className="gold-gradient-text font-display"
          >
            You've reached a milestone
          </Celebration.Text>
          <Celebration.Hint delay={1.2} />
          <Celebration.Particles count={16} enhanced />
        </Celebration>
      </div>
    )
  },
}
