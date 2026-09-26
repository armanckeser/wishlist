import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "motion/react"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface CelebrationContextValue {
  /** Base delay offset (e.g., longer when image present) */
  baseDelay: number
  /** Dismiss the celebration */
  dismiss: () => void
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null)

function useCelebrationContext() {
  const context = useContext(CelebrationContext)
  if (!context) {
    throw new Error("Celebration components must be used within <Celebration>")
  }
  return context
}

// -----------------------------------------------------------------------------
// Base Celebration
// -----------------------------------------------------------------------------

interface CelebrationProps {
  /** Trigger celebration - increment to play */
  trigger: number
  /** Callback when celebration completes (via tap) */
  onComplete?: () => void
  /** Custom tap handler (if provided, overrides default dismiss behavior) */
  onTap?: () => void
  /** Base delay for animations (use higher value when image present) */
  baseDelay?: number
  /** Content to render */
  children: ReactNode
}

/**
 * Base celebration component providing the shared shell:
 * portal, backdrop, ambient glow, tap-to-dismiss.
 *
 * Uses Radix Dialog primitives under the hood to get proper scroll locking
 * and touch event handling on mobile (via react-remove-scroll).
 *
 * Use with compound components: Celebration.Image, .Headline, .Text, .Hint
 */
function CelebrationRoot({
  trigger,
  onComplete,
  onTap,
  baseDelay = 0,
  children,
}: CelebrationProps) {
  const [isActive, setIsActive] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (trigger > 0) {
      setIsActive(true)
      setKey((k) => k + 1)
    }
  }, [trigger])

  const dismiss = () => {
    setIsActive(false)
    onComplete?.()
  }

  const handleTap = () => {
    if (onTap) {
      onTap()
    } else {
      dismiss()
    }
  }

  // Handle Dialog's onOpenChange - only allow closing via our tap handler
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Dialog wants to close (e.g., Escape key) - use our dismiss flow
      dismiss()
    }
  }

  return (
    <CelebrationContext.Provider value={{ baseDelay, dismiss }}>
      <DialogPrimitive.Root open={isActive} onOpenChange={handleOpenChange}>
        <AnimatePresence>
          {isActive && (
            <DialogPrimitive.Portal forceMount>
              {/* Overlay provides scroll locking via react-remove-scroll */}
              <DialogPrimitive.Overlay asChild>
                <motion.div
                  key={`overlay-${key}`}
                  className="fixed inset-0 z-[9999] bg-background"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.98 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              </DialogPrimitive.Overlay>

              {/* Content - fullscreen, handles focus trap */}
              <DialogPrimitive.Content
                asChild
                // Prevent closing on click outside since our tap button handles it
                onInteractOutside={(e) => e.preventDefault()}
                // Prevent closing on focus outside
                onFocusOutside={(e) => e.preventDefault()}
                // Hide the default close behavior on pointer down outside
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <motion.div
                  key={`content-${key}`}
                  className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Subtle ambient glow */}
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, oklch(0.85 0.12 80 / 0.06) 0%, transparent 60%)",
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: [0, 1, 0.7, 1],
                      scale: [0.8, 1.3, 1.1, 1.2],
                    }}
                    transition={{
                      duration: 4,
                      ease: "easeOut",
                      times: [0, 0.3, 0.6, 1],
                    }}
                  />

                  {/* Main content */}
                  <div className="relative z-10 flex flex-col items-center px-8 text-center">
                    {/* Hidden title for accessibility */}
                    <DialogPrimitive.Title className="sr-only">
                      Celebration
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      Tap anywhere to continue
                    </DialogPrimitive.Description>
                    {children}
                  </div>

                  {/* Tap to dismiss/advance */}
                  <motion.button
                    type="button"
                    className="absolute inset-0 z-20 cursor-default"
                    onClick={handleTap}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    aria-label="Dismiss celebration"
                  />
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </CelebrationContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Celebration.Image
// -----------------------------------------------------------------------------

interface ImageProps {
  src: string
  alt?: string
  /** Delay before animation starts */
  delay?: number
  /** Apply blur effect (for reveal animations) */
  blur?: boolean
  /** Gold ring for special items */
  ring?: boolean
  /** Gold shimmer overlay */
  shimmer?: boolean
}

function CelebrationImage({
  src,
  alt = "Item",
  delay = 0.2,
  blur = false,
  ring = false,
  shimmer = false,
}: ImageProps) {
  const { baseDelay } = useCelebrationContext()
  const totalDelay = baseDelay + delay

  // When blur=true, skip entrance blur so image stays blurred until reveal
  // When blur=false, do the entrance de-blur effect
  return (
    <motion.div
      className={`relative mb-6 h-32 w-24 overflow-hidden rounded-lg shadow-2xl sm:h-40 sm:w-32 ${
        ring ? "ring-2 ring-milestone-gold/60" : ""
      }`}
      initial={{ opacity: 0, scale: blur ? 0.9 : 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 1,
        delay: totalDelay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <motion.img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        initial={{ filter: blur ? "blur(12px)" : "blur(20px)" }}
        animate={{ filter: blur ? "blur(12px)" : "blur(0px)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {shimmer && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-milestone-gold/20 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.2] }}
          transition={{ duration: 2, delay: totalDelay + 0.3 }}
        />
      )}
    </motion.div>
  )
}

// -----------------------------------------------------------------------------
// Celebration.Headline
// -----------------------------------------------------------------------------

interface HeadlineProps {
  children: ReactNode
  /** Delay before animation starts */
  delay?: number
  /** Whether headline is visible (for phase-based reveals) */
  visible?: boolean
  /** Use gold gradient text */
  gold?: boolean
  /** Additional class names */
  className?: string
}

function CelebrationHeadline({
  children,
  delay = 0.3,
  visible = true,
  gold = false,
  className = "",
}: HeadlineProps) {
  const { baseDelay } = useCelebrationContext()
  const totalDelay = baseDelay + delay

  return (
    <motion.h1
      className={`font-display text-4xl font-light tracking-wide sm:text-5xl ${
        gold ? "gold-gradient-text" : "text-foreground"
      } ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: visible ? 1 : 0, y: 0 }}
      transition={{
        duration: 0.8,
        delay: totalDelay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.h1>
  )
}

// -----------------------------------------------------------------------------
// Celebration.Text
// -----------------------------------------------------------------------------

interface TextProps {
  children: ReactNode
  /** Delay before animation starts */
  delay?: number
  /** Whether text is visible (for phase-based reveals) */
  visible?: boolean
  /** Text variant */
  variant?: "title" | "body" | "muted"
  /** Additional class names */
  className?: string
}

const textVariantClasses: Record<NonNullable<TextProps["variant"]>, string> = {
  title: "font-display text-lg font-light text-foreground sm:text-xl",
  body: "text-sm text-muted-foreground",
  muted: "text-sm text-muted-foreground",
}

function CelebrationText({
  children,
  delay = 0.5,
  visible = true,
  variant = "body",
  className = "",
}: TextProps) {
  const { baseDelay } = useCelebrationContext()
  const totalDelay = baseDelay + delay

  return (
    <motion.p
      className={`mt-3 max-w-xs ${textVariantClasses[variant]} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: visible ? 1 : 0, y: 0 }}
      transition={{ duration: 0.6, delay: visible ? totalDelay : 0 }}
    >
      {children}
    </motion.p>
  )
}

// -----------------------------------------------------------------------------
// Celebration.Hint
// -----------------------------------------------------------------------------

interface HintProps {
  children?: ReactNode
  /** Delay before animation starts */
  delay?: number
  /** Additional class names */
  className?: string
}

function CelebrationHint({
  children = "tap to continue",
  delay = 1.5,
  className = "",
}: HintProps) {
  const { baseDelay } = useCelebrationContext()
  const totalDelay = baseDelay + delay

  return (
    <motion.p
      className={`mt-10 text-xs text-muted-foreground/50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: totalDelay }}
    >
      {children}
    </motion.p>
  )
}

// -----------------------------------------------------------------------------
// Celebration.Particles
// -----------------------------------------------------------------------------

interface ParticlesProps {
  /** Number of particles */
  count?: number
  /** Whether to use enhanced particles (larger, brighter) */
  enhanced?: boolean
}

function CelebrationParticles({ count = 6, enhanced = false }: ParticlesProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className={`absolute rounded-full ${
            enhanced
              ? "h-1.5 w-1.5 bg-milestone-gold/30"
              : "h-1 w-1 bg-milestone-gold/20"
          }`}
          style={{
            left: `${15 + Math.random() * 70}%`,
            top: `${15 + Math.random() * 70}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, enhanced ? 0.6 : 0.4, 0],
            scale: [0, enhanced ? 2 : 1.5, 0.5],
            y: [0, -40 - Math.random() * (enhanced ? 50 : 30)],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: 1 + Math.random() * 2,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  )
}

// -----------------------------------------------------------------------------
// Exports (Compound Component Pattern)
// -----------------------------------------------------------------------------

export const Celebration = Object.assign(CelebrationRoot, {
  Image: CelebrationImage,
  Headline: CelebrationHeadline,
  Text: CelebrationText,
  Hint: CelebrationHint,
  Particles: CelebrationParticles,
})
