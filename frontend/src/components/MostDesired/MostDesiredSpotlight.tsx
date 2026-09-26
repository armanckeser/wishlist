import { motion } from "motion/react"
import { useCallback, useState } from "react"

import { formatPrice, formatTimeUntilReady } from "@/components/Wishlist/utils"
import { useBudgetInfo } from "@/contexts/BudgetInfoContext"
import { useCooloff } from "@/contexts/CooloffContext"
import { useMostDesired } from "@/contexts/MostDesiredContext"

// Gold color palette for material feel
const GOLD = {
  dark: "#8B7355",
  mid: "#C4A962",
  light: "#E8D5A3",
  bright: "#F5EBC8",
}

const STORAGE_KEY = "most-desired-spotlight-view"

type SpotlightView = "vessel" | "needle"

interface MostDesiredSpotlightProps {
  /** Click handler when the spotlight is tapped */
  onClick?: () => void
  className?: string
}

/**
 * Prominent spotlight display for the most desired item.
 * Tap on item name to open drawer, tap on price/needle to toggle view.
 * Typography-focused with gold material treatment.
 */
export function MostDesiredSpotlight({ onClick }: MostDesiredSpotlightProps) {
  const { mostDesiredItem } = useMostDesired()
  const budgetInfo = useBudgetInfo()
  const { getMaturityInfo } = useCooloff()

  // View state with localStorage persistence
  const [view, setView] = useState<SpotlightView>(() => {
    if (typeof window === "undefined") return "vessel"
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "needle" ? "needle" : "vessel"
  })

  const toggleView = useCallback(() => {
    setView((prev) => {
      const next = prev === "vessel" ? "needle" : "vessel"
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  if (!mostDesiredItem || !budgetInfo) {
    return null
  }

  // Get unified maturity info that considers BOTH cooldown AND affordability
  const maturityInfo = getMaturityInfo(
    mostDesiredItem,
    budgetInfo,
    false, // isViewer
  )

  const price = mostDesiredItem.price_cents
  const currentBudget = budgetInfo.currentCents
  // Progress is 0-1 from maturity info, convert to percentage
  const progressPercent = maturityInfo.progress * 100
  // Item is only "ready" when BOTH cooldown is complete AND affordable
  const isReady = maturityInfo.state === "ready"
  const daysUntilReady = maturityInfo.daysUntilReady

  return (
    <div className="w-full touch-manipulation select-none">
      {view === "vessel" ? (
        <VesselView
          title={mostDesiredItem.title}
          price={price}
          progressPercent={progressPercent}
          daysUntilReady={daysUntilReady}
          onTitleClick={onClick}
          onToggleView={toggleView}
        />
      ) : (
        <NeedleView
          title={mostDesiredItem.title}
          currentBudget={currentBudget}
          price={price}
          progressPercent={progressPercent}
          daysUntilReady={daysUntilReady}
          isReady={isReady}
          onTitleClick={onClick}
          onToggleView={toggleView}
        />
      )}
    </div>
  )
}

// =============================================================================
// Vessel View - Typography fills like liquid
// =============================================================================

export interface VesselViewProps {
  title: string
  price: number
  progressPercent: number
  daysUntilReady: number
  onTitleClick?: () => void
  onToggleView: () => void
}

export function VesselView({
  title,
  price,
  progressPercent,
  daysUntilReady,
  onTitleClick,
  onToggleView,
}: VesselViewProps) {
  const priceDisplay = `$${formatPrice(price)}`

  return (
    <div className="relative flex flex-col items-center py-6">
      {/* Title - opens drawer */}
      <button
        type="button"
        onClick={onTitleClick}
        className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground hover:opacity-80 focus:outline-none"
      >
        {title}
      </button>

      {/* Price display - toggles view */}
      <button
        type="button"
        onClick={onToggleView}
        className="relative select-none pb-2 focus:outline-none"
      >
        {/* Empty vessel */}
        <span className="font-display text-6xl font-extralight tracking-tight text-muted-foreground/15 tabular-nums sm:text-7xl">
          {priceDisplay}
        </span>

        {/* Liquid fill - clips from left, animated */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <span
            className="font-display text-6xl font-extralight tracking-tight tabular-nums whitespace-nowrap sm:text-7xl"
            style={{
              background: `linear-gradient(90deg, ${GOLD.mid} 0%, ${GOLD.bright} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {priceDisplay}
          </span>
        </motion.div>
      </button>

      {/* Days remaining - non-interactive */}
      <span className="mt-3 text-sm text-muted-foreground">
        {formatTimeUntilReady(daysUntilReady)}
      </span>
    </div>
  )
}

// =============================================================================
// Needle View - Minimal track with gold glow
// =============================================================================

export interface NeedleViewProps {
  title: string
  currentBudget: number
  price: number
  progressPercent: number
  daysUntilReady: number
  isReady: boolean
  onTitleClick?: () => void
  onToggleView: () => void
}

export function NeedleView({
  title,
  currentBudget,
  price,
  progressPercent,
  daysUntilReady,
  isReady,
  onTitleClick,
  onToggleView,
}: NeedleViewProps) {
  // Clamp progress to 100% for display purposes
  const displayProgress = Math.min(progressPercent, 100)

  return (
    <div className="flex flex-col items-center py-4">
      {/* Title - opens drawer */}
      <button
        type="button"
        onClick={onTitleClick}
        className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground hover:opacity-80 focus:outline-none"
      >
        {title}
      </button>

      {/* Track container - toggles view */}
      <button
        type="button"
        onClick={onToggleView}
        className="relative mt-5 h-14 w-full max-w-xs px-2 focus:outline-none"
      >
        {/* Base track */}
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-border" />

        {/* Progress track - gold gradient */}
        <motion.div
          className="absolute left-2 top-1/2 h-px -translate-y-1/2"
          style={{
            background: `linear-gradient(90deg, ${GOLD.dark} 0%, ${GOLD.mid} 100%)`,
          }}
          initial={{ width: 0 }}
          animate={{
            width: isReady
              ? "calc(100% - 16px)"
              : `calc(${displayProgress}% - 8px)`,
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* The needle - gold with subtle glow */}
        <motion.div
          className="absolute top-0 bottom-0 w-px"
          style={{
            background: GOLD.mid,
            boxShadow: `0 0 8px ${GOLD.mid}40`,
          }}
          initial={{ left: "8px" }}
          animate={{
            left: isReady
              ? "calc(100% - 8px)"
              : `clamp(8px, ${displayProgress}%, calc(100% - 8px))`,
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Labels */}
        <div className="absolute left-2 -bottom-1">
          <span className="text-[10px] text-muted-foreground/50">$0</span>
        </div>

        {/* Current budget label - only show when not ready and not too close to target (< 85%) */}
        {!isReady && displayProgress < 85 && (
          <motion.div
            className="absolute -bottom-1 -translate-x-1/2"
            initial={{ left: "8px" }}
            animate={{ left: `calc(${displayProgress}%)` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <span
              className="font-display text-sm font-medium tabular-nums"
              style={{ color: GOLD.mid }}
            >
              ${formatPrice(currentBudget)}
            </span>
          </motion.div>
        )}

        {/* Target price label - gold when ready */}
        <div className="absolute right-2 -bottom-1">
          <span
            className="font-display text-sm tabular-nums"
            style={{ color: isReady ? GOLD.mid : undefined }}
          >
            ${formatPrice(price)}
          </span>
        </div>
      </button>

      {/* Days remaining - non-interactive */}
      <span className="mt-6 text-sm text-muted-foreground">
        {formatTimeUntilReady(daysUntilReady)}
      </span>
    </div>
  )
}
