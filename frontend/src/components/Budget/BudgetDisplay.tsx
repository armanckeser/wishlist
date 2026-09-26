import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BudgetService } from "@/client"
import { cn } from "@/lib/utils"

import { AnimationPortal, type MilestoneLevel } from "./effects"
import { useLiveBudget } from "./useLiveBudget"
import {
  calculateReturnBonus,
  formatTimeSince,
  saveVisitData,
} from "./useVisitTracker"

/**
 * Format time remaining until a date.
 */
function formatTimeRemaining(until: Date): string {
  const now = new Date()
  const diffMs = until.getTime() - now.getTime()

  if (diffMs <= 0) return ""

  const diffSecs = Math.floor(diffMs / 1000)
  const days = Math.floor(diffSecs / 86400)
  const hours = Math.floor((diffSecs % 86400) / 3600)
  const minutes = Math.floor((diffSecs % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

interface BudgetDisplayProps {
  className?: string
  /** Optional callback ref for intersection observation */
  tickerRef?: (node: HTMLDivElement | null) => void
}

interface ReturnBonus {
  gainedCents: number
  timeSinceLastVisit: number
  currentBudgetCents: number
}

/**
 * Discriminated union representing display phases.
 * State machine: loading → return_view → animating → ticker
 *                   └─────────────────────────────────┘ (skip if no bonus)
 */
type DisplayPhase =
  | { type: "loading" }
  | { type: "return_view"; bonus: ReturnBonus }
  | { type: "animating"; animatedValue: number; bonus: ReturnBonus }
  | { type: "ticker" }

interface CelebrationState {
  level: MilestoneLevel | null
  trigger: number
}

/**
 * Formats cents to display string (2 decimal places).
 */
function formatCentsToDisplay(cents: number): string {
  const absCents = Math.abs(cents)
  const dollars = absCents / 100
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Determines the celebration level based on gained cents.
 */
function getCelebrationLevel(gainedCents: number): MilestoneLevel {
  const dollars = gainedCents / 100
  if (dollars >= 100) return "hundredDollar"
  if (dollars >= 10) return "tenDollar"
  if (dollars >= 1) return "dollar"
  return "dime"
}

/**
 * Parse freeze_until string into Date, handling timezone.
 */
function parseFreezeUntil(freezeUntil: string | null | undefined): Date | null {
  if (!freezeUntil) return null
  return new Date(freezeUntil.endsWith("Z") ? freezeUntil : `${freezeUntil}Z`)
}

/**
 * Real-time budget display with smooth 60fps animation.
 * Includes "while you were away" return bonus feature.
 */
export function BudgetDisplay({ className, tickerRef }: BudgetDisplayProps) {
  const animationRef = useRef<number | null>(null)
  const animationAnchorRef = useRef<HTMLDivElement>(null)

  // Single discriminated union for display phase
  const [phase, setPhase] = useState<DisplayPhase>({ type: "loading" })

  // Celebration effects - level and trigger combined for clarity
  const [celebration, setCelebration] = useState<CelebrationState>({
    level: null,
    trigger: 0,
  })

  // State to track freeze countdown (updates every minute)
  const [freezeCountdownKey, setFreezeCountdownKey] = useState(0)

  const triggerCelebration = useCallback((level: MilestoneLevel) => {
    setCelebration((prev) => ({ level, trigger: prev.trigger + 1 }))
  }, [])

  const {
    data: budget,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["budget"],
    queryFn: () => BudgetService.getBudget(),
    refetchInterval: 60000,
  })

  // Use live budget hook - only active in ticker phase
  const { state, displayRefs } = useLiveBudget({
    budget: phase.type === "ticker" ? budget : undefined,
    onMilestone: triggerCelebration,
  })

  // Derive freezeUntil from budget - not stored as state
  const freezeUntil = useMemo(
    () => parseFreezeUntil(budget?.freeze_until),
    [budget?.freeze_until],
  )

  // Derive freezeRemaining from freezeUntil - computed, not stored
  const freezeRemaining = useMemo(() => {
    if (!freezeUntil || !state.isFrozen) return ""
    // Using freezeCountdownKey to force recalculation every minute
    void freezeCountdownKey
    return formatTimeRemaining(freezeUntil)
  }, [freezeUntil, state.isFrozen, freezeCountdownKey])

  // Update freeze countdown every minute
  useEffect(() => {
    if (!freezeUntil || !state.isFrozen) return

    const interval = setInterval(() => {
      setFreezeCountdownKey((k) => k + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [freezeUntil, state.isFrozen])

  // Transition: loading → return_view or ticker when budget data arrives
  useEffect(() => {
    if (!budget || phase.type !== "loading") return

    // Calculate current cents directly for initial check
    const lastUpdatedAt = new Date(budget.last_updated_at).getTime()
    const rate = (budget.monthly_rate_cents ?? 0) / (30 * 24 * 60 * 60 * 1000)
    const baseCents = budget.cents_at_last_update ?? 0
    const currentCents = baseCents + (Date.now() - lastUpdatedAt) * rate

    const bonus = calculateReturnBonus(currentCents)

    if (bonus) {
      // Explicit transition: loading → return_view
      setPhase({
        type: "return_view",
        bonus: {
          gainedCents: bonus.gainedCents,
          timeSinceLastVisit: bonus.timeSinceLastVisit,
          currentBudgetCents: currentCents,
        },
      })
    } else {
      saveVisitData(currentCents)
      // Explicit transition: loading → ticker
      setPhase({ type: "ticker" })
    }
  }, [budget, phase.type])

  // Transition: return_view → animating → ticker on tap
  const handleTapToReveal = useCallback(() => {
    if (phase.type !== "return_view") return

    const { bonus } = phase
    const celebrationLevel = getCelebrationLevel(bonus.gainedCents)
    triggerCelebration(celebrationLevel)

    // Explicit transition: return_view → animating
    setPhase({
      type: "animating",
      animatedValue: bonus.gainedCents,
      bonus,
    })

    const startValue = bonus.gainedCents
    const endValue = bonus.currentBudgetCents
    const duration = 1500
    const startTime = Date.now()

    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const currentValue = startValue + (endValue - startValue) * eased

      if (progress < 1) {
        // Update animated value within animating phase
        setPhase((prev) => {
          if (prev.type !== "animating") return prev
          return { ...prev, animatedValue: currentValue }
        })
        animationRef.current = requestAnimationFrame(animate)
      } else {
        saveVisitData(endValue)
        // Explicit transition: animating → ticker
        setPhase({ type: "ticker" })
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [phase, triggerCelebration])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // Determine gradient class: frozen > negative > normal
  const gradientClass = state.isFrozen
    ? "blue-gradient-text"
    : state.isNegative
      ? "red-gradient-text"
      : null

  // Loading state
  if (isLoading || phase.type === "loading") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-14 w-52 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("text-center text-destructive", className)}>
        Failed to load budget
      </div>
    )
  }

  // Return bonus view - waiting for tap
  if (phase.type === "return_view") {
    const { bonus } = phase
    return (
      <button
        type="button"
        onClick={handleTapToReveal}
        className={cn(
          "flex flex-col items-center focus:outline-none",
          className,
        )}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          While you were away
        </span>

        <div className="mt-3 flex items-baseline">
          <span className="gold-gradient-text font-display text-4xl font-light">
            +$
          </span>
          <span className="gold-gradient-text font-display text-7xl md:text-8xl font-light tracking-tight tabular-nums">
            {formatCentsToDisplay(bonus.gainedCents)}
          </span>
        </div>

        <span className="mt-2 text-xs text-muted-foreground">
          {formatTimeSince(bonus.timeSinceLastVisit)}
        </span>

        <span className="mt-4 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
          tap to continue
        </span>

        <div
          className="mt-6 h-px w-32"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--milestone-gold), transparent)",
          }}
        />
      </button>
    )
  }

  // Animating state - counter going from gain to total
  if (phase.type === "animating") {
    const [dollars, cents] = formatCentsToDisplay(phase.animatedValue).split(
      ".",
    )
    return (
      <div className={cn("flex flex-col items-center", className)}>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground animate-in fade-in duration-500">
          Available to spend
        </span>

        <div className="relative mt-3">
          <AnimationPortal
            level={celebration.level}
            trigger={celebration.trigger}
            anchorRef={animationAnchorRef}
          />

          <div ref={animationAnchorRef} className="flex items-baseline">
            <span className="font-display text-4xl font-light text-muted-foreground">
              $
            </span>
            <span className="font-display text-7xl md:text-8xl font-light tracking-tight text-foreground tabular-nums">
              {dollars}
            </span>
            <span className="font-display text-4xl font-light text-muted-foreground tabular-nums">
              .{cents}
            </span>
          </div>
        </div>

        {budget && (
          <span className="mt-3 text-xs text-muted-foreground animate-in fade-in duration-500 delay-300">
            +${((budget.monthly_rate_cents ?? 0) / 100).toFixed(0)}/month
          </span>
        )}

        <div className="mt-6 h-px w-32 bg-border" />
      </div>
    )
  }

  // Live ticker state (phase.type === "ticker")
  return (
    <div
      ref={tickerRef ?? undefined}
      className={cn("flex flex-col items-center", className)}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Available to spend
      </span>

      <div className="relative mt-2">
        <AnimationPortal
          level={celebration.level}
          trigger={celebration.trigger}
          anchorRef={displayRefs.dollarsRef}
        />

        <div className={cn("relative flex items-baseline", gradientClass)}>
          <span
            className={cn(
              "font-display text-4xl font-light",
              !gradientClass && "text-muted-foreground",
            )}
          >
            {state.isNegative && "-"}$
          </span>
          <span
            ref={displayRefs.dollarsRef}
            className={cn(
              "font-display text-7xl md:text-8xl font-light tracking-tight tabular-nums",
              !gradientClass && "text-foreground",
            )}
          >
            0
          </span>
          <span
            ref={displayRefs.decimalRef}
            className={cn(
              "font-display text-4xl font-light tabular-nums",
              !gradientClass && "text-muted-foreground",
            )}
          >
            .000000
          </span>
        </div>
      </div>

      {budget && (
        <span className="mt-3 text-xs text-muted-foreground">
          {state.isFrozen && freezeRemaining
            ? `Frozen for ${freezeRemaining}`
            : `+$${((budget.monthly_rate_cents ?? 0) / 100).toFixed(0)}/month`}
        </span>
      )}

      <div className="mt-6 h-px w-32 bg-border" />
    </div>
  )
}
