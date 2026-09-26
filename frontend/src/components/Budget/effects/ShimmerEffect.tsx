import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"

interface ShimmerEffectProps {
  trigger: number
  duration?: number
}

/**
 * Golden shimmer sweep effect.
 * A warm gold highlight sweeps left-to-right across the container.
 * Like light catching a luxury watch face.
 */
export function ShimmerEffect({ trigger, duration = 600 }: ShimmerEffectProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (trigger > 0) {
      setIsActive(true)
      setKey((k) => k + 1)
      const timer = setTimeout(() => setIsActive(false), duration)
      return () => clearTimeout(timer)
    }
  }, [trigger, duration])

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key={key}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-y-0 w-1/3"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--milestone-glow), var(--milestone-gold-bright), var(--milestone-glow), transparent)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "400%" }}
            transition={{
              duration: duration / 1000,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
