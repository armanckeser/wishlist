import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"

interface BurstParticle {
  id: number
  angle: number
  distance: number
  size: number
  delay: number
  isWhite: boolean
  curve: number // Adds curve to the trajectory
}

interface CelebrationEffectProps {
  trigger: number
  burstCount?: number
  duration?: number
}

/**
 * Celebration burst effect for major milestones.
 * Particles burst outward in random directions with curved paths,
 * some trailing sparkles, creating a firework-like celebration.
 */
export function CelebrationEffect({
  trigger,
  burstCount = 20,
  duration = 1500,
}: CelebrationEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  const particles = useMemo<BurstParticle[]>(() => {
    return Array.from({ length: burstCount }, (_, i) => ({
      id: i,
      angle: Math.random() * 360,
      distance: 80 + Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.2,
      isWhite: i % 4 === 0,
      curve: (Math.random() - 0.5) * 60, // Random curve left or right
    }))
  }, [burstCount])

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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
          {/* Center flash */}
          <motion.div
            key={`${key}-flash`}
            className="absolute rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--milestone-gold-bright) 0%, transparent 70%)",
            }}
            initial={{ width: 10, height: 10, opacity: 0 }}
            animate={{
              width: [10, 120, 80],
              height: [10, 120, 80],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
            }}
          />

          {/* Burst particles */}
          {particles.map((particle) => {
            const angleRad = (particle.angle * Math.PI) / 180
            const curveRad = (particle.curve * Math.PI) / 180
            const endX = Math.cos(angleRad) * particle.distance
            const endY = Math.sin(angleRad) * particle.distance
            // Curved midpoint
            const midX =
              Math.cos(angleRad + curveRad) * (particle.distance * 0.6)
            const midY =
              Math.sin(angleRad + curveRad) * (particle.distance * 0.6)

            const particleColor = particle.isWhite
              ? "oklch(0.98 0.02 80)"
              : "var(--milestone-gold-bright)"
            const glowColor = particle.isWhite
              ? "oklch(1 0 0 / 0.9)"
              : "var(--milestone-glow)"

            return (
              <motion.div
                key={`${key}-${particle.id}`}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  background: particleColor,
                  boxShadow: `0 0 ${particle.size * 3}px ${glowColor}`,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                }}
                animate={{
                  x: [0, midX, endX],
                  y: [0, midY, endY],
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.5, 1, 0.5],
                }}
                transition={{
                  duration: duration / 1000,
                  delay: particle.delay,
                  ease: [0.25, 0.1, 0.25, 1],
                  opacity: { times: [0, 0.1, 0.6, 1] },
                }}
              />
            )
          })}

          {/* Secondary wave of smaller particles */}
          {particles.slice(0, 10).map((particle) => {
            const angleRad = ((particle.angle + 180) * Math.PI) / 180
            const endX = Math.cos(angleRad) * (particle.distance * 0.7)
            const endY = Math.sin(angleRad) * (particle.distance * 0.7)

            return (
              <motion.div
                key={`${key}-secondary-${particle.id}`}
                className="absolute rounded-full"
                style={{
                  width: particle.size * 0.6,
                  height: particle.size * 0.6,
                  background: "var(--milestone-gold)",
                  boxShadow: `0 0 ${particle.size * 2}px var(--milestone-glow)`,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                }}
                animate={{
                  x: [0, endX],
                  y: [0, endY],
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: (duration / 1000) * 0.8,
                  delay: particle.delay + 0.15,
                  ease: "easeOut",
                }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
