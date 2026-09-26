import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"

interface Sparkle {
  id: number
  x: number
  y: number
  size: number
  delay: number
  rotation: number
}

interface SparkleEffectProps {
  trigger: number
  sparkleCount?: number
  duration?: number
}

/**
 * SVG sparkle/star shape.
 */
function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
    </svg>
  )
}

/**
 * Crystalline sparkle effect.
 * Diamond-like twinkles appear around the number and fade out.
 * Like light catching gemstones.
 */
export function SparkleEffect({
  trigger,
  sparkleCount = 8,
  duration = 1000,
}: SparkleEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  const sparkles = useMemo<Sparkle[]>(() => {
    return Array.from({ length: sparkleCount }, (_, i) => {
      // Distribute sparkles in a rough circle around center
      const angle = (i / sparkleCount) * Math.PI * 2 + Math.random() * 0.5
      const distance = 30 + Math.random() * 50
      return {
        id: i,
        x: 50 + Math.cos(angle) * distance * 0.8, // percentage
        y: 50 + Math.sin(angle) * distance * 0.5, // percentage (flatter ellipse)
        size: 8 + Math.random() * 8,
        delay: Math.random() * 0.3,
        rotation: Math.random() * 45,
      }
    })
  }, [sparkleCount])

  useEffect(() => {
    if (trigger > 0) {
      setIsActive(true)
      setKey((k) => k + 1)
      const timer = setTimeout(() => setIsActive(false), duration + 500)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  return (
    <AnimatePresence>
      {isActive && (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {sparkles.map((sparkle) => (
            <motion.div
              key={`${key}-${sparkle.id}`}
              className="absolute"
              style={{
                left: `${sparkle.x}%`,
                top: `${sparkle.y}%`,
                transform: `translate(-50%, -50%) rotate(${sparkle.rotation}deg)`,
              }}
              initial={{
                scale: 0,
                opacity: 0,
              }}
              animate={{
                scale: [0, 1.2, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: duration / 1000,
                delay: sparkle.delay,
                ease: [0.25, 0.1, 0.25, 1],
              }}
            >
              <StarShape size={sparkle.size} color="oklch(0.92 0.1 80 / 0.9)" />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
