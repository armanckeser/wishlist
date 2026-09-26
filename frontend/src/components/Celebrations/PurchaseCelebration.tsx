import { Celebration } from "./Celebration"

interface PurchaseCelebrationProps {
  /** Trigger celebration - increment to play */
  trigger: number
  /** Callback when celebration completes (via tap) */
  onComplete?: () => void
  /** The item title to display */
  itemTitle?: string
  /** The item image URL */
  itemImageUrl?: string
  /** Days waited for this item */
  daysWaited?: number
  /** Whether this was the most desired item (extra flair) */
  isMostDesired?: boolean
}

/**
 * Full-screen celebration effect for purchasing a ready-to-treat item.
 * Flow: Image → Yours → Name → "Waited X days" → (Well Deserved! if most desired) → tap to continue
 */
export function PurchaseCelebration({
  trigger,
  onComplete,
  itemTitle,
  itemImageUrl,
  daysWaited,
  isMostDesired = false,
}: PurchaseCelebrationProps) {
  const hasImage = !!itemImageUrl
  const hasWaitedDays = daysWaited !== undefined && daysWaited > 0

  // Delay offsets based on content
  const imageDelay = 0.2
  const headlineDelay = hasImage ? 0.9 : 0.1
  const titleDelay = hasImage ? 1.4 : 0.7
  const waitedDelay = hasImage ? 1.8 : 1.1
  const wellDeservedDelay = hasImage ? 2.4 : 1.7
  const hintDelay = hasImage
    ? isMostDesired
      ? 3.0
      : 2.2
    : isMostDesired
      ? 2.3
      : 1.5

  return (
    <Celebration trigger={trigger} onComplete={onComplete}>
      {itemImageUrl && (
        <Celebration.Image
          src={itemImageUrl}
          alt={itemTitle}
          delay={imageDelay}
          ring={isMostDesired}
          shimmer={isMostDesired}
        />
      )}

      <Celebration.Headline delay={headlineDelay} gold>
        Yours
      </Celebration.Headline>

      {itemTitle && (
        <Celebration.Text
          delay={titleDelay}
          variant="title"
          className="text-foreground/70"
        >
          {itemTitle}
        </Celebration.Text>
      )}

      {hasWaitedDays && (
        <Celebration.Text delay={waitedDelay} className="mt-4">
          Waited{" "}
          <span className="font-medium text-foreground">
            {daysWaited} {daysWaited === 1 ? "day" : "days"}
          </span>{" "}
          for it
        </Celebration.Text>
      )}

      {isMostDesired && (
        <Celebration.Text
          delay={wellDeservedDelay}
          className="gold-gradient-text mt-8 font-display text-lg font-light tracking-wide sm:text-xl"
        >
          Well Deserved!
        </Celebration.Text>
      )}

      <Celebration.Hint delay={hintDelay} />

      <Celebration.Particles
        count={isMostDesired ? 16 : 6}
        enhanced={isMostDesired}
      />
    </Celebration>
  )
}
