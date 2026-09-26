import { Celebration } from "./Celebration"

interface GiftSendCelebrationProps {
  /** Trigger celebration - increment to play */
  trigger: number
  /** Callback when celebration completes (via tap) */
  onComplete?: () => void
  /** The item title */
  itemTitle?: string
  /** The item image URL */
  itemImageUrl?: string
  /** Recipient name */
  recipientName?: string
  /** How many days the recipient has been waiting for this item */
  daysWaited?: number
}

/**
 * Full-screen celebration for sending a gift.
 * Shows feel-good stats about how long the recipient has been waiting.
 */
export function GiftSendCelebration({
  trigger,
  onComplete,
  itemTitle,
  itemImageUrl,
  recipientName,
  daysWaited,
}: GiftSendCelebrationProps) {
  const hasImage = !!itemImageUrl
  const hasWaitedDays = daysWaited !== undefined && daysWaited > 0

  // Delay offsets based on content
  const imageDelay = 0.2
  const headlineDelay = hasImage ? 0.8 : 0.1
  const titleDelay = hasImage ? 1.3 : 0.6
  const waitedDelay = hasImage ? 1.8 : 1.1
  const notificationDelay = hasImage ? 2.2 : 1.5
  const hintDelay = hasImage ? 2.6 : 1.9

  return (
    <Celebration trigger={trigger} onComplete={onComplete}>
      {itemImageUrl && (
        <Celebration.Image
          src={itemImageUrl}
          alt={itemTitle}
          delay={imageDelay}
        />
      )}

      <Celebration.Headline delay={headlineDelay}>
        Gift sent
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

      {recipientName && hasWaitedDays && (
        <Celebration.Text delay={waitedDelay} className="mt-6">
          <span className="font-medium text-foreground">{recipientName}</span>{" "}
          has been waiting{" "}
          <span className="font-medium text-foreground">
            {daysWaited} {daysWaited === 1 ? "day" : "days"}
          </span>{" "}
          for this
        </Celebration.Text>
      )}

      <Celebration.Text delay={notificationDelay} className="mt-4 max-w-xs">
        {recipientName ? (
          <>We'll let them know as soon as possible</>
        ) : (
          <>The recipient will be notified</>
        )}
      </Celebration.Text>

      <Celebration.Hint delay={hintDelay} />
    </Celebration>
  )
}
