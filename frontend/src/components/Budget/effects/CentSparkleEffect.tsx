import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"

interface CentSparkleEffectProps {
  trigger: number
  sparkleCount?: number
}

/**
 * SVG 4-point star sparkle shape.
 */
function Sparkle({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{
        color: "var(--milestone-gold-bright)",
        filter: "drop-shadow(0 0 4px var(--milestone-glow))",
      }}
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  )
}

interface SparklePosition {
  x: number
  y: number
  rotation: number
  size: number
  delay: number
}

/**
 * Sparkle effect for micro-milestones.
 * Supports multiple sparkles for bigger sub-dollar milestones.
 * Designed to be addictive - fires frequently to reward watching.
 */
export function CentSparkleEffect({
  trigger,
  sparkleCount = 1,
}: CentSparkleEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  // Generate positions for all sparkles
  const sparkles = useMemo<SparklePosition[]>(() => {
    return Array.from({ length: sparkleCount }, (_, i) => ({
      // Spread across the container, more spread with more sparkles
      x: 30 + Math.random() * 60,
      // Vertical spread around center
      y: 25 + Math.random() * 50,
      // Random rotation for variety
      rotation: Math.random() * 360,
      // Slight size variation - larger when fewer sparkles
      size: sparkleCount === 1 ? 12 + Math.random() * 6 : 8 + Math.random() * 5,
      // Stagger the appearance
      delay: i * 0.05,
    }))
  }, [sparkleCount])

  useEffect(() => {
    if (trigger > 0) {
      setIsActive(true)
      setKey((k) => k + 1)
      // Quick fade - this fires frequently
      const timer = setTimeout(() => setIsActive(false), 400)
      return () => clearTimeout(timer)
    }
  }, [trigger])

  return (
    <AnimatePresence>
      {isActive &&
        sparkles.map((sparkle, i) => (
          <motion.div
            key={`${key}-${i}`}
            className="pointer-events-none absolute"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              transform: `translate(-50%, -50%)`,
            }}
            initial={{
              scale: 0,
              opacity: 0,
              rotate: sparkle.rotation,
            }}
            animate={{
              scale: 1,
              opacity: [0, 1, 0.8, 0],
              rotate: sparkle.rotation + 15,
            }}
            exit={{
              scale: 0,
              opacity: 0,
            }}
            transition={{
              scale: {
                type: "spring",
                stiffness: 400,
                damping: 15,
                duration: 0.3,
              },
              opacity: {
                duration: 0.35,
                times: [0, 0.2, 0.6, 1],
              },
              rotate: {
                duration: 0.35,
                ease: "easeOut",
              },
              delay: sparkle.delay,
            }}
          >
            <Sparkle size={sparkle.size} />
          </motion.div>
        ))}
    </AnimatePresence>
  )
}
