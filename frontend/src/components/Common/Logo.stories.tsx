import type { Meta, StoryObj } from "@storybook/react-vite"

import { Logo } from "./Logo"

const meta = {
  title: "Components/Common/Logo",
  component: Logo,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "radio",
      options: ["full", "icon", "responsive"],
    },
  },
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Full wordmark logo. Default variant.
 */
export const Full: Story = {
  args: {
    variant: "full",
    asLink: false,
  },
}

/**
 * Icon-only "W" variant for compact spaces.
 */
export const Icon: Story = {
  args: {
    variant: "icon",
    asLink: false,
  },
}

/**
 * Comparison of all variants side by side.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Logo variant="full" asLink={false} />
        <span className="text-xs text-muted-foreground">Full</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Logo variant="icon" asLink={false} />
        <span className="text-xs text-muted-foreground">Icon</span>
      </div>
    </div>
  ),
}

/**
 * Logo at different sizes using className.
 */
export const CustomSizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      <div className="flex flex-col items-center gap-2">
        <Logo variant="full" asLink={false} className="h-4" />
        <span className="text-xs text-muted-foreground">h-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Logo variant="full" asLink={false} className="h-8" />
        <span className="text-xs text-muted-foreground">h-8 (default)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Logo variant="full" asLink={false} className="h-12" />
        <span className="text-xs text-muted-foreground">h-12</span>
      </div>
    </div>
  ),
}
