/**
 * useLiveBudget - Single source of truth for real-time budget state.
 *
 * Architecture:
 * - Owns the real-time budget calculation (updated every frame)
 * - Exposes currentCentsRef for synchronous reads without re-renders
 * - Provides reactive state (isNegative) that only updates on threshold crossings
 * - Handles DOM updates for display components (60fps, no re-renders)
 * - Fires callbacks for milestones and state transitions
 */

import { useCallback, useEffect, useRef, useState } from "react"

import type { BudgetPublic } from "@/client"

import type { MilestoneLevel } from "./effects"

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60

/**
 * Calculate cents accrued per millisecond from monthly rate.
 */
function centsPerMs(monthlyRateCents: number): number {
  return monthlyRateCents / (SECONDS_PER_MONTH * 1000)
}

/**
 * Format cents to display parts.
 * Returns absolute values - negativity is handled separately.
 */
function formatCentsToDisplay(cents: number): {
  dollars: string
  decimal: string
} {
  const absCents = Math.abs(cents)
  const dollars = absCents / 100

  const wholeDollars = Math.floor(dollars)
  const fractional = dollars - wholeDollars

  // 6 decimal places so last digits are always spinning
  const decimalStr = fractional.toFixed(6).slice(1) // ".123456"

  return {
    dollars: wholeDollars.toLocaleString("en-US"),
    decimal: decimalStr,
  }
}

export interface LiveBudgetState {
  /** Current budget in cents (real-time calculated value) */
  currentCents: number
  /** Whether budget is currently negative */
  isNegative: boolean
  /** Whether budget is frozen (accumulation paused) */
  isFrozen: boolean
  /** Monthly rate in cents */
  monthlyRateCents: number
}

export interface UseLiveBudgetOptions {
  /** Budget data from API */
  budget: BudgetPublic | undefined
  /** Called when milestone thresholds are crossed */
  onMilestone?: (level: MilestoneLevel) => void
}

export interface UseLiveBudgetResult {
  /** Ref holding current cents - read synchronously without re-renders */
  currentCentsRef: React.RefObject<number>

  /** Stable getter for current cents value */
  getCurrentCents: () => number

  /** Reactive state - only updates on significant changes (crossing zero, freeze change) */
  state: LiveBudgetState

  /**
   * Attach to DOM elements for 60fps display updates.
   * Call this to get refs that auto-update with formatted values.
   */
  displayRefs: {
    dollarsRef: React.RefObject<HTMLSpanElement | null>
    decimalRef: React.RefObject<HTMLSpanElement | null>
  }
}

/**
 * Hook that provides real-time budget state with 60fps display updates.
 *
 * Usage:
 * ```tsx
 * const { state, displayRefs, getCurrentCents } = useLiveBudget({ budget })
 *
 * // For display - attach refs, they auto-update at 60fps
 * <span ref={displayRefs.dollarsRef}>0</span>
 *
 * // For logic - read current value synchronously
 * const canAfford = getCurrentCents() >= itemPrice
 *
 * // For styling - reactive state updates on threshold crossings
 * <div className={state.isNegative ? "red" : "green"}>
 * ```
 */
export function useLiveBudget({
  budget,
  onMilestone,
}: UseLiveBudgetOptions): UseLiveBudgetResult {
  // Refs for 60fps updates (no re-renders)
  const currentCentsRef = useRef<number>(0)
  const dollarsRef = useRef<HTMLSpanElement | null>(null)
  const decimalRef = useRef<HTMLSpanElement | null>(null)

  // Stable ref for callback to avoid recreating animation loop
  const onMilestoneRef = useRef(onMilestone)
  onMilestoneRef.current = onMilestone

  // Milestone tracking
  const lastMilestoneRef = useRef({
    tenthCents: 0,
    cents: 0,
    dimes: 0,
    dollars: 0,
    tenDollars: 0,
    hundredDollars: 0,
  })

  // Track last known negative state to detect crossings
  const wasNegativeRef = useRef<boolean | null>(null)

  // Reactive state - only updates on significant changes
  const [state, setState] = useState<LiveBudgetState>({
    currentCents: 0,
    isNegative: false,
    isFrozen: false,
    monthlyRateCents: 0,
  })

  // Stable getter that reads from ref
  const getCurrentCents = useCallback(() => currentCentsRef.current, [])

  // Main animation loop
  useEffect(() => {
    if (!budget) return

    const lastUpdatedAt = new Date(budget.last_updated_at).getTime()
    const rate = centsPerMs(budget.monthly_rate_cents ?? 0)
    const baseCents = budget.cents_at_last_update ?? 0
    const isFrozen = budget.stashed_monthly_rate_cents != null

    // Calculate initial state
    const initialCents = baseCents + (Date.now() - lastUpdatedAt) * rate
    currentCentsRef.current = initialCents

    // Initialize milestone tracking
    lastMilestoneRef.current = {
      tenthCents: Math.floor(initialCents * 10),
      cents: Math.floor(initialCents),
      dimes: Math.floor(initialCents / 10),
      dollars: Math.floor(initialCents / 100),
      tenDollars: Math.floor(initialCents / 1000),
      hundredDollars: Math.floor(initialCents / 10000),
    }

    // Set initial reactive state
    const initialIsNegative = initialCents < 0
    wasNegativeRef.current = initialIsNegative
    setState({
      currentCents: initialCents,
      isNegative: initialIsNegative,
      isFrozen,
      monthlyRateCents: budget.monthly_rate_cents ?? 0,
    })

    let animationFrameId: number
    let lastDollars = ""
    let lastDecimal = ""

    function tick() {
      const now = Date.now()
      const elapsedMs = now - lastUpdatedAt
      const currentCents = baseCents + elapsedMs * rate

      // Update the authoritative ref
      currentCentsRef.current = currentCents

      // Format and update DOM directly (no re-render)
      const { dollars, decimal } = formatCentsToDisplay(currentCents)

      if (dollars !== lastDollars && dollarsRef.current) {
        dollarsRef.current.textContent = dollars
        lastDollars = dollars
      }

      if (decimal !== lastDecimal && decimalRef.current) {
        decimalRef.current.textContent = decimal
        lastDecimal = decimal
      }

      // Check for zero crossing - update reactive state only when crossing
      const isNegative = currentCents < 0
      if (wasNegativeRef.current !== isNegative) {
        wasNegativeRef.current = isNegative
        setState((prev) => ({
          ...prev,
          currentCents,
          isNegative,
        }))
      }

      // Check for milestones (only when positive and increasing)
      if (currentCents >= 0 && rate > 0) {
        const currentTenthCents = Math.floor(currentCents * 10)
        const currentWholeCents = Math.floor(currentCents)
        const currentDimes = Math.floor(currentCents / 10)
        const currentDollars = Math.floor(currentCents / 100)
        const currentTenDollars = Math.floor(currentCents / 1000)
        const currentHundredDollars = Math.floor(currentCents / 10000)

        if (currentHundredDollars > lastMilestoneRef.current.hundredDollars) {
          onMilestoneRef.current?.("hundredDollar")
        } else if (currentTenDollars > lastMilestoneRef.current.tenDollars) {
          onMilestoneRef.current?.("tenDollar")
        } else if (currentDollars > lastMilestoneRef.current.dollars) {
          onMilestoneRef.current?.("dollar")
        } else if (currentDimes > lastMilestoneRef.current.dimes) {
          onMilestoneRef.current?.("dime")
        } else if (currentWholeCents > lastMilestoneRef.current.cents) {
          onMilestoneRef.current?.("cent")
        } else if (currentTenthCents > lastMilestoneRef.current.tenthCents) {
          onMilestoneRef.current?.("tenthCent")
        }

        lastMilestoneRef.current = {
          tenthCents: currentTenthCents,
          cents: currentWholeCents,
          dimes: currentDimes,
          dollars: currentDollars,
          tenDollars: currentTenDollars,
          hundredDollars: currentHundredDollars,
        }
      }

      animationFrameId = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [budget])

  return {
    currentCentsRef,
    getCurrentCents,
    state,
    displayRefs: {
      dollarsRef,
      decimalRef,
    },
  }
}
