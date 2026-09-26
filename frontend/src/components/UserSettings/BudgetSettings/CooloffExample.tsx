import { useState } from "react"

import { Input } from "@/components/ui/input"
import type { CooloffSettings } from "@/contexts/CooloffContext"
import { dollarsToCents } from "@/lib/budget"

import type { CooloffExampleProps } from "./types"

/**
 * Calculate cooloff days for preview (uses form values, not saved settings).
 */
function calculatePreviewCooloffDays(
  priceCents: number,
  settings: CooloffSettings,
): number {
  let cooloffDays = 0

  // Price-based scaling
  const scalingCents = settings.cooloff_scaling_cents
  const scalingDays = settings.cooloff_scaling_days ?? 3
  if (scalingCents && scalingCents > 0) {
    cooloffDays = Math.max(
      cooloffDays,
      Math.floor((priceCents / scalingCents) * scalingDays),
    )
  }

  // Threshold
  const thresholdCents = settings.cooloff_min_threshold_cents
  const thresholdDays = settings.cooloff_min_threshold_days ?? 7
  if (thresholdCents && priceCents >= thresholdCents) {
    cooloffDays = Math.max(cooloffDays, thresholdDays)
  }

  // Max cap
  if (settings.cooloff_max_days != null) {
    cooloffDays = Math.min(cooloffDays, settings.cooloff_max_days)
  }

  return cooloffDays
}

/**
 * Dynamic example showing how cooloff would apply to a sample item.
 * Uses local calculation based on FORM values (not saved settings).
 */
export function CooloffExample({
  settings,
  freezePenaltyDays,
}: CooloffExampleProps) {
  const [priceDollars, setPriceDollars] = useState(200)

  const priceCents = dollarsToCents(priceDollars)
  const cooloffDays = calculatePreviewCooloffDays(priceCents, settings)

  const hasSettings =
    (settings.cooloff_scaling_cents ?? 0) > 0 ||
    (settings.cooloff_min_threshold_cents ?? 0) > 0

  if (!hasSettings) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Configure settings above to see an example
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <span>For example, a</span>
      <div className="relative w-20">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          value={priceDollars}
          onChange={(e) => setPriceDollars(Number(e.target.value) || 0)}
          className="h-7 pl-5 text-base"
        />
      </div>
      <span>
        item would require{" "}
        <span className="font-medium text-foreground">{cooloffDays} days</span>{" "}
        to cool off, and buying it before that would freeze the budget for{" "}
        <span className="font-medium text-foreground">
          {freezePenaltyDays} days
        </span>
        .
      </span>
    </div>
  )
}
