/**
 * Context for cooloff calculations.
 * Provides functions to calculate maturity state without passing settings everywhere.
 */

import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react"

import { BudgetService } from "@/client"
import type { WishlistItemPublic } from "@/types"

// =============================================================================
// Types
// =============================================================================

export type MaturityState = "cooling" | "growing" | "saving" | "ready"

export interface MaturityInfo {
  state: MaturityState
  label: string
  daysWishlisted: number
  daysRequired: number
  /** Progress 0-1, where 1 = fully ready (both matured AND affordable) */
  progress: number
  /** Days until item is affordable (0 if already affordable, Infinity if rate=0) */
  daysUntilAffordable: number
  /** Target day for Ready to Treat = max(cooloff, affordability) */
  targetDay: number
  /** Days remaining until Ready to Treat */
  daysUntilReady: number
}

export type ItemGroup = MaturityState | "purchased"

export interface CooloffSettings {
  cooloff_scaling_cents?: number | null
  cooloff_scaling_days?: number
  cooloff_min_threshold_cents?: number | null
  cooloff_min_threshold_days?: number
  cooloff_max_days?: number | null
  freeze_penalty_days?: number
}

/** Budget info needed for unified maturity calculation */
export interface MaturityBudgetInfo {
  /** Check if an item is affordable */
  isAffordable: (priceCents: number) => boolean
  /** Get days until item is affordable, or 0 if already affordable */
  getDaysUntilAffordable: (priceCents: number) => number
  /** Current budget in cents (for bottleneck progress calculation) */
  currentCents?: number
}

interface CooloffContextValue {
  /** Whether settings are loaded */
  isLoaded: boolean
  /** Raw settings (for forms/display) */
  settings: CooloffSettings
  /** Calculate required cooloff days for a price */
  calculateCooloffDays: (priceCents: number) => number
  /** Get maturity info for an item. Pass budgetInfo for unified affordability-aware state. */
  getMaturityInfo: (
    item: WishlistItemPublic,
    budgetInfo?: MaturityBudgetInfo | null,
    isViewer?: boolean,
  ) => MaturityInfo
  /** Get the display group for an item */
  getItemGroup: (
    item: WishlistItemPublic,
    budgetInfo?: MaturityBudgetInfo | null,
    isViewer?: boolean,
  ) => ItemGroup
  /** Freeze penalty days */
  freezePenaltyDays: number
}

// =============================================================================
// Pure calculation functions (internal)
// =============================================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24

function calculateRequiredCooloffDays(
  priceCents: number,
  settings: CooloffSettings,
): number {
  let cooloffDays = 0

  // Price-based scaling: "For every $X, add Y days"
  const scalingCents = settings.cooloff_scaling_cents
  const scalingDays = settings.cooloff_scaling_days ?? 3
  if (scalingCents && scalingCents > 0) {
    const priceUnits = priceCents / scalingCents
    const scaledDays = Math.floor(priceUnits * scalingDays)
    cooloffDays = Math.max(cooloffDays, scaledDays)
  }

  // Minimum threshold: "Items over $X need at least Y days"
  const thresholdCents = settings.cooloff_min_threshold_cents
  const thresholdDays = settings.cooloff_min_threshold_days ?? 7
  if (thresholdCents && priceCents >= thresholdCents) {
    cooloffDays = Math.max(cooloffDays, thresholdDays)
  }

  // Apply maximum cap if set
  if (settings.cooloff_max_days != null) {
    cooloffDays = Math.min(cooloffDays, settings.cooloff_max_days)
  }

  return cooloffDays
}

/**
 * Get midnight (00:00) of a given date in local timezone.
 */
function getMidnight(date: Date): Date {
  const midnight = new Date(date)
  midnight.setHours(0, 0, 0, 0)
  return midnight
}

/**
 * Get midnight of a target day (addedDate + days) in local timezone.
 * Items become ready at midnight on the target day.
 */
function getTargetMidnight(addedDate: Date, days: number): Date {
  const target = new Date(addedDate)
  target.setDate(target.getDate() + days)
  return getMidnight(target)
}

function calculateMaturityInfo(
  addedAt: string,
  priceCents: number,
  settings: CooloffSettings,
  budgetInfo?: MaturityBudgetInfo | null,
  cooldownWaivedAt?: string | null,
  isViewer?: boolean,
): MaturityInfo {
  const addedDate = new Date(addedAt)
  const now = new Date()
  const nowMs = now.getTime()
  const daysSinceAdded = (nowMs - addedDate.getTime()) / MS_PER_DAY
  const daysWishlisted = Math.floor(daysSinceAdded)

  // Check if cooldown was waived
  const cooldownWaived = !!cooldownWaivedAt

  // Cooloff days required based on price and settings
  // If waived, treat cooldown as satisfied (0 days required)
  const daysRequired = cooldownWaived
    ? 0
    : calculateRequiredCooloffDays(priceCents, settings)

  // "Growing On You" starts at halfway through cooloff
  const growingThreshold = Math.floor(daysRequired / 2)

  // Calculate target midnights for state transitions
  // State transitions happen at midnight to match daysUntilReady calculation
  const growingStartAt = getTargetMidnight(addedDate, growingThreshold)
  const cooloffReadyAt = getTargetMidnight(addedDate, daysRequired)
  const pastGrowingThreshold = nowMs >= growingStartAt.getTime()
  const cooloffComplete = nowMs >= cooloffReadyAt.getTime()

  // Calculate affordability if budget info is provided
  const daysUntilAffordable =
    budgetInfo?.getDaysUntilAffordable(priceCents) ?? 0
  const isAffordable = budgetInfo?.isAffordable(priceCents) ?? true

  // Target day is the later of: cooloff completion OR affordability
  // dayWhenBudgetReachesPrice is absolute day since item was added
  const dayWhenBudgetReachesPrice = isAffordable
    ? daysSinceAdded // already affordable
    : daysSinceAdded + daysUntilAffordable

  const targetDay = Math.max(daysRequired, dayWhenBudgetReachesPrice)

  // Determine which factor is the bottleneck for progress
  const cooloffRemaining = Math.max(0, daysRequired - daysSinceAdded)
  const isBudgetBottleneck = daysUntilAffordable > cooloffRemaining

  // Calculate progress based on whichever bottleneck is limiting
  let progress: number
  if (isBudgetBottleneck) {
    // Budget is the bottleneck: progress = currentBudget / itemPrice
    const currentBudget = budgetInfo?.currentCents ?? 0
    progress = priceCents > 0 ? Math.min(currentBudget / priceCents, 1) : 1
  } else {
    // Cooloff is the bottleneck: progress = daysElapsed / cooloffDays
    progress = daysRequired > 0 ? Math.min(daysSinceAdded / daysRequired, 1) : 1
  }

  // Calculate time remaining until ready (uses same midnight-based logic as state)
  const affordabilityMsRemaining = isAffordable
    ? 0
    : daysUntilAffordable * MS_PER_DAY
  const msUntilReady = Math.max(
    0,
    Math.max(cooloffReadyAt.getTime() - nowMs, affordabilityMsRemaining),
  )
  // Return fractional days to enable hours display when < 1 day.
  const daysUntilReady = msUntilReady / MS_PER_DAY

  // State machine (uses midnight-based transitions to match daysUntilReady):
  // - Cooling Off: before midnight of halfway day
  // - Growing On You: after halfway midnight, before cooloff midnight
  // - Saving Up: past cooloff but NOT affordable
  // - Ready to Treat: past cooloff AND affordable

  if (!pastGrowingThreshold) {
    return {
      state: "cooling",
      label: "cooling off",
      daysWishlisted,
      daysRequired,
      progress,
      daysUntilAffordable,
      targetDay,
      daysUntilReady,
    }
  }

  if (!cooloffComplete) {
    return {
      state: "growing",
      label: "growing on you",
      daysWishlisted,
      daysRequired,
      progress,
      daysUntilAffordable,
      targetDay,
      daysUntilReady,
    }
  }

  // Past cooloff: check affordability
  if (!isAffordable) {
    // Viewers skip "saving up" - if cooldown is done, it's ready to treat
    if (isViewer) {
      return {
        state: "ready",
        label: "ready to treat",
        daysWishlisted,
        daysRequired,
        progress: 1,
        daysUntilAffordable: 0,
        targetDay: daysRequired, // Target is just cooloff completion
        daysUntilReady: 0,
      }
    }

    // Owners see "saving up" as before
    return {
      state: "saving",
      label: "saving up",
      daysWishlisted,
      daysRequired,
      progress,
      daysUntilAffordable,
      targetDay,
      daysUntilReady,
    }
  }

  return {
    state: "ready",
    label: "ready to treat",
    daysWishlisted,
    daysRequired,
    progress: 1,
    daysUntilAffordable: 0,
    targetDay,
    daysUntilReady: 0,
  }
}

// =============================================================================
// Context
// =============================================================================

const CooloffContext = createContext<CooloffContextValue | undefined>(undefined)

const DEFAULT_SETTINGS: CooloffSettings = {
  cooloff_scaling_cents: null,
  cooloff_scaling_days: 3,
  cooloff_min_threshold_cents: null,
  cooloff_min_threshold_days: 7,
  cooloff_max_days: null,
  freeze_penalty_days: 7,
}

interface CooloffProviderProps {
  children: ReactNode
  /** Optional mock settings for testing/debug (bypasses API) */
  mockSettings?: CooloffSettings
  /** Override settings (e.g., owner's settings when viewing a shared wishlist) */
  overrideSettings?: CooloffSettings
}

export function CooloffProvider({
  children,
  mockSettings,
  overrideSettings,
}: CooloffProviderProps) {
  const { data: budget } = useQuery({
    queryKey: ["budget"],
    queryFn: () => BudgetService.getBudget(),
    refetchInterval: 60000,
    enabled: !mockSettings && !overrideSettings, // Skip API call when using mock or override settings
  })

  const settings: CooloffSettings = useMemo(() => {
    if (mockSettings) return mockSettings
    if (overrideSettings) return overrideSettings
    if (!budget) return DEFAULT_SETTINGS
    return {
      cooloff_scaling_cents: budget.cooloff_scaling_cents,
      cooloff_scaling_days: budget.cooloff_scaling_days,
      cooloff_min_threshold_cents: budget.cooloff_min_threshold_cents,
      cooloff_min_threshold_days: budget.cooloff_min_threshold_days,
      cooloff_max_days: budget.cooloff_max_days,
      freeze_penalty_days: budget.freeze_penalty_days,
    }
  }, [budget, mockSettings, overrideSettings])

  const calculateCooloffDays = useCallback(
    (priceCents: number) => calculateRequiredCooloffDays(priceCents, settings),
    [settings],
  )

  const getMaturityInfo = useCallback(
    (
      item: WishlistItemPublic,
      budgetInfo?: MaturityBudgetInfo | null,
      isViewer?: boolean,
    ) => {
      // Extract cooldown_waived_at based on item status
      const cooldownWaivedAt =
        item.status === "wishlisted" ? item.cooldown_waived_at : null

      return calculateMaturityInfo(
        item.added_at,
        item.price_cents,
        settings,
        budgetInfo,
        cooldownWaivedAt,
        isViewer,
      )
    },
    [settings],
  )

  const getItemGroup = useCallback(
    (
      item: WishlistItemPublic,
      budgetInfo?: MaturityBudgetInfo | null,
      isViewer?: boolean,
    ): ItemGroup => {
      if (item.status === "purchased") {
        return "purchased"
      }
      // Use the new getMaturityInfo wrapper that handles extraction
      return getMaturityInfo(item, budgetInfo, isViewer).state
    },
    [getMaturityInfo],
  )

  const value: CooloffContextValue = useMemo(
    () => ({
      isLoaded: !!mockSettings || !!overrideSettings || !!budget,
      settings,
      calculateCooloffDays,
      getMaturityInfo,
      getItemGroup,
      freezePenaltyDays: settings.freeze_penalty_days ?? 7,
    }),
    [
      mockSettings,
      overrideSettings,
      budget,
      settings,
      calculateCooloffDays,
      getMaturityInfo,
      getItemGroup,
    ],
  )

  return (
    <CooloffContext.Provider value={value}>{children}</CooloffContext.Provider>
  )
}

/**
 * Hook to access cooloff calculations.
 * Must be used within CooloffProvider.
 */
export function useCooloff(): CooloffContextValue {
  const context = useContext(CooloffContext)
  if (!context) {
    throw new Error("useCooloff must be used within a CooloffProvider")
  }
  return context
}
