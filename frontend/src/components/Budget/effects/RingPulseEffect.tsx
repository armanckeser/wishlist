import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"

interface RingPulseEffectProps {
  trigger: number
  duration?: number
  ringCount?: number
}

/**
 * Expanding ring pulse effect.
 * Ring starts transparent at center, fades in as it expands, then fades out.
 * Achievement unlocked feeling.
 */
export function RingPulseEffect({
  trigger,
  duration = 800,
  ringCount = 1,
}: RingPulseEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (trigger > 0) {
      setIsActive(true)
      setKey((k) => k + 1)
      const timer = setTimeout(() => setIsActive(false), duration + 200)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  const rings = Array.from({ length: ringCount }, (_, i) => i)

  return (
    <AnimatePresence>
      {isActive && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible">
          {rings.map((ringIndex) => (
            <motion.div
              key={`${key}-${ringIndex}`}
              className="absolute rounded-full"
              style={{
                border: "2px solid var(--milestone-gold)",
                boxShadow:
                  "0 0 20px var(--milestone-glow), inset 0 0 10px var(--milestone-glow)",
              }}
              initial={{
                width: 20,
                height: 20,
                opacity: 0,
              }}
              animate={{
                width: 280,
                height: 280,
                opacity: [0, 0.8, 0.5, 0],
              }}
              transition={{
                duration: duration / 1000,
                delay: ringIndex * 0.12,
                ease: "easeOut",
                opacity: {
                  times: [0, 0.15, 0.5, 1],
                },
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
