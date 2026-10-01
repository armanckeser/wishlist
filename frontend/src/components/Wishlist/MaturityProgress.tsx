"use client"

import type { MaturityState } from "@/contexts/CooloffContext"
import { cn } from "@/lib/utils"

interface MaturityProgressProps {
  /** Progress from 0 to 1 */
  progress: number
  /** Current maturity state */
  state: MaturityState
  className?: string
}

/**
 * Progress bar with grey → gold → white gradient background.
 * Progress acts as a mask revealing the gradient from left to right.
 * Ready to Treat shows solid gold bar.
 * Note: Do not render this component for purchased items.
 */
export function MaturityProgress({
  progress,
  state,
  className,
}: MaturityProgressProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const widthPercent = Math.max(clampedProgress * 100, 2) // Min 2% for visibility
  const isReady = state === "ready"

  // Ready state: solid gold
  // Progress state: grey → white → BRIGHTEST at 100%
  const fillBackground = isReady
    ? "var(--milestone-gold)"
    : `linear-gradient(90deg,
        oklch(0.45 0 0) 0%,
        oklch(0.55 0 0) 30%,
        oklch(0.75 0 0) 60%,
        oklch(0.9 0.05 80) 85%,
        oklch(0.98 0.12 80) 100%)`

  return (
    <div
      className={cn(
        "relative h-0.5 w-full overflow-hidden rounded-full",
        className,
      )}
    >
      {/* Dimmed background - same gradient at low opacity */}
      <div
        className="absolute inset-0 rounded-full opacity-20"
        style={{ background: fillBackground }}
      />
      {/* Progress reveal - full opacity */}
      <div
        className="absolute inset-0 rounded-full transition-[clip-path] duration-500"
        style={{
          background: fillBackground,
          clipPath: `inset(0 ${100 - widthPercent}% 0 0)`,
        }}
      />
    </div>
  )
}
