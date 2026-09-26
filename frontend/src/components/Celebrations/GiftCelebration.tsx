import { useEffect, useState } from "react"
import { Celebration } from "./Celebration"

interface GiftCelebrationProps {
  /** Trigger celebration - increment to play */
  trigger: number
  /** Callback when celebration completes (via tap after reveal) */
  onComplete?: () => void
  /** The item title */
  itemTitle?: string
  /** The item image URL */
  itemImageUrl?: string
  /** Name of the gifter */
  gifterName?: string
  /** Gift message from the gifter */
  giftMessage?: string
}

type Phase = "teaser" | "revealed"

/**
 * Full-screen celebration for receiving a gift.
 * Flow: "A gift for you" → blurred image → tap → de-blur, reveal details one by one
 * Stable layout throughout - no position changes, just opacity/blur transforms.
 */
export function GiftCelebration({
  trigger,
  onComplete,
  itemTitle,
  itemImageUrl,
  gifterName,
  giftMessage,
}: GiftCelebrationProps) {
  const [phase, setPhase] = useState<Phase>("teaser")

  // Reset phase when trigger changes
  useEffect(() => {
    if (trigger > 0) {
      setPhase("teaser")
    }
  }, [trigger])

  const isRevealed = phase === "revealed"

  const handleTap = () => {
    if (phase === "teaser") {
      setPhase("revealed")
    }
    // When revealed, don't provide onTap so Celebration's default dismiss runs
  }

  // Delay offsets
  const headlineDelay = 0.1
  const imageDelay = 0.6
  const titleDelay = 0.2
  const gifterDelay = 0.4
  const messageDelay = 0.6
  const hintDelay = 1.4

  return (
    <Celebration
      trigger={trigger}
      onComplete={onComplete}
      onTap={phase === "teaser" ? handleTap : undefined}
    >
      {/* "A gift for you" - stays visible throughout */}
      <Celebration.Headline delay={headlineDelay} className="mb-8">
        A gift for you
      </Celebration.Headline>

      {/* Item image - blurred in teaser, clear in revealed */}
      {itemImageUrl && (
        <Celebration.Image
          src={itemImageUrl}
          alt={itemTitle}
          delay={imageDelay}
          blur={!isRevealed}
        />
      )}

      {/* Item name - appears on reveal */}
      {itemTitle && (
        <Celebration.Text
          delay={titleDelay}
          visible={isRevealed}
          variant="title"
        >
          {itemTitle}
        </Celebration.Text>
      )}

      {/* From gifter - appears on reveal */}
      {gifterName && (
        <Celebration.Text delay={gifterDelay} visible={isRevealed}>
          From <span className="font-medium text-foreground">{gifterName}</span>
        </Celebration.Text>
      )}

      {/* Gift message - appears on reveal */}
      {giftMessage && (
        <Celebration.Text
          delay={messageDelay}
          visible={isRevealed}
          className="mt-6 max-w-sm italic"
        >
          "{giftMessage}"
        </Celebration.Text>
      )}

      {/* Tap hint - changes text but stays in place */}
      <Celebration.Hint delay={hintDelay}>
        {isRevealed ? "tap to continue" : "tap to reveal"}
      </Celebration.Hint>
    </Celebration>
  )
}
