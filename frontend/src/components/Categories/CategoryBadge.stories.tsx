import type { Meta, StoryObj } from "@storybook/react-vite"

import { CategoryBadge } from "./CategoryBadge"

const meta: Meta<typeof CategoryBadge> = {
  title: "Components/Categories/CategoryBadge",
  component: CategoryBadge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    size: {
      control: "radio",
      options: ["sm", "md"],
    },
    onRemove: { action: "removed" },
  },
}

export default meta
type Story = StoryObj<typeof CategoryBadge>

export const Default: Story = {
  args: {
    name: "Jewelry",
  },
}

export const Small: Story = {
  args: {
    name: "Jewelry",
    size: "sm",
  },
}

export const WithRemoveButton: Story = {
  args: {
    name: "Fashion",
    onRemove: () => {},
  },
}

export const SmallWithRemove: Story = {
  args: {
    name: "Fashion",
    size: "sm",
    onRemove: () => {},
  },
}

/**
 * Categories get deterministic colors based on their name.
 * The same name always produces the same color.
 */
export const ColorVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <CategoryBadge name="Jewelry" />
      <CategoryBadge name="Fashion" />
      <CategoryBadge name="Beauty" />
      <CategoryBadge name="Home" />
      <CategoryBadge name="Tech" />
      <CategoryBadge name="Books" />
      <CategoryBadge name="Art" />
      <CategoryBadge name="Travel" />
    </div>
  ),
}

/**
 * Comparison of both sizes with remove buttons.
 */
export const SizeComparison: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-12">md:</span>
        <CategoryBadge name="Jewelry" size="md" onRemove={() => {}} />
        <CategoryBadge name="Fashion" size="md" onRemove={() => {}} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-12">sm:</span>
        <CategoryBadge name="Jewelry" size="sm" onRemove={() => {}} />
        <CategoryBadge name="Fashion" size="sm" onRemove={() => {}} />
      </div>
    </div>
  ),
}
