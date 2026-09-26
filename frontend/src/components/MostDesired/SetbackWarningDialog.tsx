import { AlertTriangle, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeepSavingButton } from "@/components/Wishlist/KeepSavingButton"

interface SetbackWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Name of the item they're about to view */
  itemTitle: string
  /** Price of the item in cents */
  itemPriceCents: number
  /** Name of their most desired item */
  mostDesiredItemTitle: string
  /** Number of days this purchase would set back the goal */
  daysSetback: number
  /** URL to open when they proceed */
  productUrl: string
}

/**
 * Warning dialog shown when a ready-to-treat item's "View on Site" is clicked.
 * Reminds the user how many days buying this item would delay their goal.
 */
export function SetbackWarningDialog({
  open,
  onOpenChange,
  mostDesiredItemTitle,
  daysSetback,
  productUrl,
}: SetbackWarningDialogProps) {
  const formattedDays =
    daysSetback < 1
      ? "less than a day"
      : daysSetback === 1
        ? "1 day"
        : `${Math.round(daysSetback)} days`

  const handleProceed = () => {
    window.open(productUrl, "_blank", "noopener,noreferrer")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle>Just a heads up</DialogTitle>
          <DialogDescription className="pt-2 text-sm text-muted-foreground">
            Buying this would delay{" "}
            <span className="font-medium text-foreground">
              {mostDesiredItemTitle}
            </span>{" "}
            by{" "}
            <span className="font-medium text-foreground">{formattedDays}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex-col gap-3 sm:flex-col">
          <KeepSavingButton
            onComplete={() => onOpenChange(false)}
            className="h-12 w-full"
            variant="primary"
          />
          <Button
            onClick={handleProceed}
            variant="outline"
            className="h-12 w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
