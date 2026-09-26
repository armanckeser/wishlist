import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeepSavingButton } from "@/components/Wishlist/KeepSavingButton"

interface ArchiveFeedbackCardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Name of the item being considered for archive */
  itemTitle: string
  /** Name of the most desired item */
  mostDesiredItemTitle: string
  /** Number of days the purchase would have set back the goal */
  daysSetback: number
}

/**
 * Feedback card shown when archiving a ready-to-treat item.
 * Displays how many days the purchase would have delayed the goal.
 * Uses KeepSaving button with pig animation to confirm.
 */
export function ArchiveFeedbackCard({
  open,
  onOpenChange,
  itemTitle,
  mostDesiredItemTitle,
  daysSetback,
}: ArchiveFeedbackCardProps) {
  const formattedDays =
    daysSetback < 1
      ? "less than a day"
      : daysSetback === 1
        ? "1 day"
        : `${Math.round(daysSetback)} days`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-light">
            Good call
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{itemTitle}</span>{" "}
                would have set you back{" "}
                <span className="font-medium text-foreground">
                  {formattedDays}
                </span>{" "}
                toward{" "}
                <span className="font-medium text-foreground">
                  {mostDesiredItemTitle}
                </span>
                .
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <KeepSavingButton
          onComplete={() => onOpenChange(false)}
          className="mt-2 h-12 w-full"
        />
      </DialogContent>
    </Dialog>
  )
}
