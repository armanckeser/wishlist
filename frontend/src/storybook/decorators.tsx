/**
 * Storybook decorators for providing context to components.
 * Use these to wrap stories that require specific React context providers.
 */

import type { ReactRenderer } from "@storybook/react-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import type { DecoratorFunction } from "storybook/internal/types"
import {
  FilterProvider,
  getDefaultViewState,
  type ViewState,
} from "@/components/Wishlist/filtering"
import { BudgetInfoProvider } from "@/contexts/BudgetInfoContext"
import type { CooloffSettings } from "@/contexts/CooloffContext"
import { CooloffProvider } from "@/contexts/CooloffContext"
import { MostDesiredProvider } from "@/contexts/MostDesiredContext"
import { SelectionProvider } from "@/contexts/SelectionContext"
import { WishlistRoleProvider } from "@/contexts/WishlistRoleContext"
import type { BudgetInfo } from "@/hooks/useBudget"
import type { WishlistItemPublic } from "@/types"

import {
  MOCK_BUDGET_INFO,
  MOCK_COOLOFF_SETTINGS,
  MOCK_WISHLIST_ITEMS,
} from "./mocks"

// =============================================================================
// Query Client Decorator
// =============================================================================

const storyQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
})

/**
 * Provides TanStack Query context for components that use useQuery hooks.
 * Most simple component stories won't need this.
 */
export const withQueryClient: DecoratorFunction<ReactRenderer> = (Story) => (
  <QueryClientProvider client={storyQueryClient}>
    <Story />
  </QueryClientProvider>
)

// =============================================================================
// Filter Provider Wrapper
// =============================================================================

/**
 * Internal wrapper component that manages FilterProvider state.
 * Needed because FilterProvider requires viewState + onViewStateChange.
 */
function FilterProviderWrapper({
  children,
  items,
  budgetInfo,
}: {
  children: React.ReactNode
  items: WishlistItemPublic[]
  budgetInfo: BudgetInfo | null
}) {
  const [viewState, setViewState] = useState<ViewState>(
    getDefaultViewState("wishlist") as ViewState,
  )

  return (
    <FilterProvider
      items={items}
      budgetInfo={budgetInfo}
      viewState={viewState}
      onViewStateChange={setViewState}
    >
      {children}
    </FilterProvider>
  )
}

// =============================================================================
// Combined Wishlist Decorator
// =============================================================================

interface WishlistDecoratorOptions {
  budgetInfo?: BudgetInfo | null
  cooloffSettings?: CooloffSettings
  items?: WishlistItemPublic[]
}

/**
 * Creates a decorator that wraps stories with all wishlist-related providers.
 * Use this for components that need multiple contexts.
 */
export function createWishlistDecorator(
  options: WishlistDecoratorOptions = {},
): DecoratorFunction<ReactRenderer> {
  const {
    budgetInfo = MOCK_BUDGET_INFO,
    cooloffSettings = MOCK_COOLOFF_SETTINGS,
    items = MOCK_WISHLIST_ITEMS,
  } = options

  return (Story) => (
    <QueryClientProvider client={storyQueryClient}>
      <BudgetInfoProvider mockBudgetInfo={budgetInfo}>
        <CooloffProvider mockSettings={cooloffSettings}>
          <MostDesiredProvider items={items} userId="storybook-user">
            <WishlistRoleProvider
              ownerId="storybook-user"
              currentUserId="storybook-user"
            >
              <SelectionProvider>
                <FilterProviderWrapper items={items} budgetInfo={budgetInfo}>
                  <Story />
                </FilterProviderWrapper>
              </SelectionProvider>
            </WishlistRoleProvider>
          </MostDesiredProvider>
        </CooloffProvider>
      </BudgetInfoProvider>
    </QueryClientProvider>
  )
}

/**
 * Default wishlist decorator with standard mock values.
 * Import and use in story decorators array.
 */
export const withWishlistProviders = createWishlistDecorator()

// =============================================================================
// Cooloff Only Decorator
// =============================================================================

/**
 * Creates a decorator with just CooloffProvider.
 * Use for components that only need cooloff calculations.
 */
export function createCooloffDecorator(
  settings: CooloffSettings = MOCK_COOLOFF_SETTINGS,
): DecoratorFunction<ReactRenderer> {
  return (Story) => (
    <QueryClientProvider client={storyQueryClient}>
      <CooloffProvider mockSettings={settings}>
        <Story />
      </CooloffProvider>
    </QueryClientProvider>
  )
}

export const withCooloff = createCooloffDecorator()

// =============================================================================
// Selection Mode Decorator
// =============================================================================

/**
 * Decorator for components that use SelectionContext.
 */
export const withSelection: DecoratorFunction<ReactRenderer> = (Story) => (
  <SelectionProvider>
    <Story />
  </SelectionProvider>
)

// =============================================================================
// Budget Info Only Decorator
// =============================================================================

/**
 * Creates a decorator with just BudgetInfoProvider.
 * Use for components that only need budget calculations.
 */
export function createBudgetDecorator(
  budgetInfo: BudgetInfo | null = MOCK_BUDGET_INFO,
): DecoratorFunction<ReactRenderer> {
  return (Story) => (
    <QueryClientProvider client={storyQueryClient}>
      <BudgetInfoProvider mockBudgetInfo={budgetInfo}>
        <Story />
      </BudgetInfoProvider>
    </QueryClientProvider>
  )
}

export const withBudget = createBudgetDecorator()
