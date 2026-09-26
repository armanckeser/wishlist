import { PiggyBank } from "lucide-react"
import { motion, useAnimation } from "motion/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface KeepSavingButtonProps {
  onComplete?: () => void
  className?: string
  /** Button variant - defaults to outline */
  variant?: "outline" | "primary"
}

export function KeepSavingButton({
  onComplete,
  className,
  variant = "outline",
}: KeepSavingButtonProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const controls = useAnimation()

  const handleClick = async () => {
    if (isCollecting) return

    setIsCollecting(true)

    // 1. Trigger the coin drops
    await controls.start("drop")

    // 2. Shake the pig after coins land
    setShowFeedback(true)
    await controls.start("shake")

    // 3. Reset and callback
    if (onComplete) onComplete()

    setTimeout(() => {
      setIsCollecting(false)
      setShowFeedback(false)
      controls.set("idle")
    }, 500)
  }

  return (
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      onClick={handleClick}
      disabled={isCollecting}
      className={cn(
        "relative w-full overflow-hidden transition-all duration-300",
        showFeedback && "border-amber-500/60 bg-amber-500/10",
        className,
      )}
    >
      <div className="relative flex items-center justify-center gap-2">
        {/* Container for Icon + Coins */}
        <div className="relative flex h-8 w-10 items-center justify-center">
          {/* Staggered coins dropping into piggy */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute z-0 h-2 w-2 rounded-full bg-amber-400 shadow-sm"
              style={{ left: "50%", x: "-50%", top: -20 }}
              variants={{
                idle: { y: 0, opacity: 0, scale: 0 },
                drop: {
                  y: [0, 25],
                  scale: [1, 0.5],
                  opacity: [1, 1, 0],
                  transition: {
                    delay: i * 0.2,
                    duration: 0.4,
                    ease: "backIn",
                  },
                },
              }}
              initial="idle"
              animate={controls}
            />
          ))}

          {/* Piggy sits on top, masks coins */}
          <motion.div
            className={cn(
              "relative z-10 transition-colors duration-200",
              showFeedback && "text-amber-500",
            )}
            variants={{
              idle: { rotate: 0 },
              shake: {
                rotate: [0, -10, 10, -10, 10, 0],
                transition: { duration: 0.5 },
              },
            }}
            initial="idle"
            animate={controls}
          >
            <PiggyBank className="h-6 w-6" />
          </motion.div>
        </div>

        <span className="relative z-10">Keep Saving</span>
      </div>
    </Button>
  )
}
