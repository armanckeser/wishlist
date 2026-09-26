import { CelebrationEffect } from "./CelebrationEffect"
import { CentSparkleEffect } from "./CentSparkleEffect"
import { ParticleDustEffect } from "./ParticleDustEffect"
import { RingPulseEffect } from "./RingPulseEffect"
import { ShimmerEffect } from "./ShimmerEffect"

export type MilestoneLevel =
  | "tenthCent"
  | "cent"
  | "dime"
  | "dollar"
  | "tenDollar"
  | "hundredDollar"

interface MilestoneEffectsProps {
  level: MilestoneLevel | null
  trigger: number
}

/**
 * Milestone effects component with distinct effects per tier.
 * Each tier has a unique visual identity, not just scaled versions.
 *
 * Tiers:
 * - tenthCent ($0.001): 1 sparkle - most frequent reward
 * - cent ($0.01): 2 sparkles
 * - dime ($0.10): 3 sparkles
 * - dollar ($1): Shimmer sweep across number
 * - tenDollar ($10): Shimmer + orbiting particles
 * - hundredDollar ($100): Full celebration burst
 */
export function MilestoneEffects({ level, trigger }: MilestoneEffectsProps) {
  if (!level || trigger === 0) return null

  switch (level) {
    case "tenthCent":
      // Single tiny sparkle - most frequent micro-reward
      return <CentSparkleEffect trigger={trigger} sparkleCount={1} />

    case "cent":
      // 2 sparkles - still very frequent
      return <CentSparkleEffect trigger={trigger} sparkleCount={2} />

    case "dime":
      // 3 sparkles - noticeable moment
      return <CentSparkleEffect trigger={trigger} sparkleCount={3} />

    case "dollar":
      // Shimmer sweep - elegant light passing over
      return <ShimmerEffect trigger={trigger} duration={500} />

    case "tenDollar":
      // Shimmer + ring pulse
      return (
        <>
          <ShimmerEffect trigger={trigger} duration={600} />
          <RingPulseEffect trigger={trigger} duration={800} />
        </>
      )

    case "hundredDollar":
      // Full celebration - burst + rising particles
      return (
        <>
          <ShimmerEffect trigger={trigger} duration={600} />
          <CelebrationEffect
            trigger={trigger}
            burstCount={24}
            duration={1400}
          />
          <ParticleDustEffect
            trigger={trigger}
            particleCount={18}
            duration={1600}
          />
        </>
      )

    default:
      return null
  }
}
