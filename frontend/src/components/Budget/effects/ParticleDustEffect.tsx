import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"

interface Particle {
  id: number
  x: number
  delay: number
  size: number
  opacity: number
}

interface ParticleDustEffectProps {
  trigger: number
  particleCount?: number
  duration?: number
}

/**
 * Gold dust particle effect.
 * Tiny particles emanate upward and fade out.
 * More particles = bigger milestone.
 */
export function ParticleDustEffect({
  trigger,
  particleCount = 12,
  duration = 1200,
}: ParticleDustEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage across container
      delay: Math.random() * 0.3,
      size: 2 + Math.random() * 3,
      opacity: 0.4 + Math.random() * 0.4,
    }))
  }, [particleCount])

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
          {particles.map((particle) => {
            // Mix of gold and bright white particles for sparkle
            const isWhite = particle.id % 3 === 0
            const particleColor = isWhite
              ? `oklch(0.98 0.02 80 / ${particle.opacity + 0.3})`
              : `var(--milestone-gold-bright)`
            const glowColor = isWhite
              ? "oklch(1 0 0 / 0.8)"
              : "var(--milestone-glow)"

            return (
              <motion.div
                key={`${key}-${particle.id}`}
                className="absolute rounded-full"
                style={{
                  left: `${particle.x}%`,
                  bottom: "20%",
                  width: particle.size,
                  height: particle.size,
                  background: particleColor,
                  boxShadow: `0 0 ${particle.size * 3}px ${glowColor}`,
                }}
                initial={{
                  y: 0,
                  opacity: particle.opacity,
                  scale: 0,
                }}
                animate={{
                  y: -80 - Math.random() * 40,
                  opacity: 0,
                  scale: 1,
                }}
                transition={{
                  duration: duration / 1000,
                  delay: particle.delay,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
