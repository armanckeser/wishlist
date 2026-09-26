import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BudgetInfoProvider } from "@/contexts/BudgetInfoContext"
import {
  CooloffProvider,
  type CooloffSettings,
} from "@/contexts/CooloffContext"
import { MostDesiredProvider } from "@/contexts/MostDesiredContext"
import type { BudgetInfo } from "@/hooks/useBudget"
import {
  createMockBudgetInfo,
  createMockItem,
  MOCK_COOLOFF_SETTINGS,
} from "@/storybook/mocks"
import type { WishlistItemPublic } from "@/types"
import {
  MostDesiredSpotlight,
  NeedleView as NeedleViewComponent,
  VesselView as VesselViewComponent,
} from "./MostDesiredSpotlight"

const storyQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

/** Creates the full provider stack for spotlight stories */
function SpotlightProviders({
  children,
  mostDesiredItem,
  budgetInfo,
  cooloffSettings = MOCK_COOLOFF_SETTINGS,
}: {
  children: React.ReactNode
  mostDesiredItem: WishlistItemPublic | null
  budgetInfo: BudgetInfo
  cooloffSettings?: CooloffSettings
}) {
  // MostDesiredProvider derives mostDesiredItem from items array
  const items = mostDesiredItem ? [mostDesiredItem] : []

  return (
    <QueryClientProvider client={storyQueryClient}>
      <BudgetInfoProvider mockBudgetInfo={budgetInfo}>
        <CooloffProvider mockSettings={cooloffSettings}>
          <MostDesiredProvider items={items} userId="storybook-user">
            {children}
          </MostDesiredProvider>
        </CooloffProvider>
      </BudgetInfoProvider>
    </QueryClientProvider>
  )
}

const meta: Meta<typeof MostDesiredSpotlight> = {
  title: "Components/MostDesired/Spotlight",
  component: MostDesiredSpotlight,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    onClick: { action: "clicked" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MostDesiredSpotlight>

// Mock items at different price points
const expensiveItem = createMockItem({
  title: "Gold Vermeil Ring",
  priceCents: 28500, // $285
  daysAgo: 14,
  isMostDesired: true,
})

const cheapItem = createMockItem({
  title: "Pearl Earrings",
  priceCents: 8500, // $85
  daysAgo: 14,
  isMostDesired: true,
})

/**
 * Vessel view (default) - Typography fills like liquid from left to right.
 * User has $171 budget, targeting $285 item (~60% progress).
 */
export const VesselView: Story = {
  decorators: [
    (Story) => (
      <SpotlightProviders
        mostDesiredItem={expensiveItem}
        budgetInfo={createMockBudgetInfo(17100, 60000)} // $171 budget, $600/month
      >
        <Story />
      </SpotlightProviders>
    ),
  ],
}

/**
 * Vessel view at low progress - early in saving.
 */
export const VesselLowProgress: Story = {
  decorators: [
    (Story) => (
      <SpotlightProviders
        mostDesiredItem={expensiveItem}
        budgetInfo={createMockBudgetInfo(5000, 60000)} // $50 budget, $600/month
      >
        <Story />
      </SpotlightProviders>
    ),
  ],
}

/**
 * Vessel view at high progress - almost there.
 */
export const VesselHighProgress: Story = {
  decorators: [
    (Story) => (
      <SpotlightProviders
        mostDesiredItem={expensiveItem}
        budgetInfo={createMockBudgetInfo(25000, 60000)} // $250 budget, $600/month
      >
        <Story />
      </SpotlightProviders>
    ),
  ],
}

/**
 * Ready state - item is affordable.
 */
export const Ready: Story = {
  decorators: [
    (Story) => (
      <SpotlightProviders
        mostDesiredItem={cheapItem}
        budgetInfo={createMockBudgetInfo(15000, 60000)} // $150 budget, item is $85
      >
        <Story />
      </SpotlightProviders>
    ),
  ],
}

/**
 * No most desired item set - component renders nothing.
 * (Renders empty container for demonstration)
 */
export const NoMostDesired: Story = {
  decorators: [
    (Story) => (
      <SpotlightProviders
        mostDesiredItem={null}
        budgetInfo={createMockBudgetInfo()}
      >
        <div className="flex items-center justify-center h-32 border border-dashed border-border rounded text-muted-foreground text-sm">
          No spotlight (no most desired item)
          <Story />
        </div>
      </SpotlightProviders>
    ),
  ],
}

// =============================================================================
// Direct Component Stories (no context required - pure props)
// These allow testing VesselView and NeedleView with arbitrary props
// =============================================================================

/**
 * VesselView with direct props - 60% progress
 */
export const VesselDirect: Story = {
  render: () => (
    <VesselViewComponent
      title="Gold Vermeil Ring"
      price={28500}
      progressPercent={60}
      daysUntilReady={3.5}
      onToggleView={() => {}}
    />
  ),
}

/**
 * VesselView with low progress (15%)
 */
export const VesselLow: Story = {
  render: () => (
    <VesselViewComponent
      title="Luxury Watch"
      price={150000}
      progressPercent={15}
      daysUntilReady={21}
      onToggleView={() => {}}
    />
  ),
}

/**
 * VesselView almost ready (95%)
 */
export const VesselAlmostReady: Story = {
  render: () => (
    <VesselViewComponent
      title="Pearl Earrings"
      price={8500}
      progressPercent={95}
      daysUntilReady={0.3}
      onToggleView={() => {}}
    />
  ),
}

/**
 * VesselView fully ready (100%)
 */
export const VesselFullyReady: Story = {
  render: () => (
    <VesselViewComponent
      title="Designer Sunglasses"
      price={32000}
      progressPercent={100}
      daysUntilReady={0}
      onToggleView={() => {}}
    />
  ),
}

/**
 * NeedleView with mid progress (60%)
 */
export const NeedleMidProgress: Story = {
  render: () => (
    <NeedleViewComponent
      title="Gold Vermeil Ring"
      currentBudget={17100}
      price={28500}
      progressPercent={60}
      daysUntilReady={3.5}
      isReady={false}
      onToggleView={() => {}}
    />
  ),
}

/**
 * NeedleView with low progress (15%)
 */
export const NeedleLowProgress: Story = {
  render: () => (
    <NeedleViewComponent
      title="Luxury Watch"
      currentBudget={22500}
      price={150000}
      progressPercent={15}
      daysUntilReady={21}
      isReady={false}
      onToggleView={() => {}}
    />
  ),
}

/**
 * NeedleView with high progress (94%)
 */
export const NeedleHighProgress: Story = {
  render: () => (
    <NeedleViewComponent
      title="Pearl Earrings"
      currentBudget={8000}
      price={8500}
      progressPercent={94}
      daysUntilReady={0.3}
      isReady={false}
      onToggleView={() => {}}
    />
  ),
}

/**
 * NeedleView fully ready - needle at end
 */
export const NeedleReady: Story = {
  render: () => (
    <NeedleViewComponent
      title="Designer Sunglasses"
      currentBudget={35000}
      price={32000}
      progressPercent={100}
      daysUntilReady={0}
      isReady={true}
      onToggleView={() => {}}
    />
  ),
}
