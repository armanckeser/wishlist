import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import type { UndoDestination } from "@/client"
import { WishlistService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import type { WishlistItemPublic } from "@/types"
import { handleError } from "@/utils"

const UNDO_REASONS = [
  { label: "Returned the item", value: "Returned the item" },
  { label: "Never shipped / refunded", value: "Never shipped / refunded" },
  { label: "Marked by mistake", value: "Marked by mistake" },
  { label: "Exchanged it", value: "Exchanged it" },
  { label: "Sold it", value: "Sold it" },
]

interface UndoDialogProps {
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const parsed = Number.parseFloat(cleaned)
  if (Number.isNaN(parsed)) return null
  return Math.round(parsed * 100)
}

/**
 * Dialog for undoing a purchase or gift with flexible options.
 * Allows choosing destination (wishlist/archive) and refund amount.
 */
export function UndoDialog({ item, open, onOpenChange }: UndoDialogProps) {
  const queryClient = useQueryClient()
  const { showErrorToast, showSuccessToast } = useCustomToast()

  const isGifted = item?.status === "gifted"

  // State
  const [destination, setDestination] = useState<UndoDestination>("wishlist")
  const [refundValue, setRefundValue] = useState("")
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState("")

  // Initialize values when dialog opens with an item
  useEffect(() => {
    if (open && item) {
      setDestination("wishlist")
      // Default refund: full price for purchases, 0 for gifts
      const itemIsPurchased = item.status === "purchased"
      setRefundValue(itemIsPurchased ? formatCents(item.price_cents) : "0.00")
      setSelectedReason(null)
      setCustomReason("")
    }
  }, [open, item])

  const mutation = useMutation({
    mutationFn: ({
      itemId,
      destination,
      refundCents,
      reason,
    }: {
      itemId: string
      destination: UndoDestination
      refundCents: number | null
      reason: string | null
    }) =>
      WishlistService.undoItemEndpoint({
        itemId,
        requestBody: {
          destination,
          refund_cents: refundCents,
          reason: reason ?? undefined,
        },
      }),
    onSuccess: () => {
      const destLabel = destination === "wishlist" ? "wishlist" : "archive"
      showSuccessToast(`Item moved to ${destLabel}`)
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
      queryClient.invalidateQueries({ queryKey: ["budget"] })
    },
  })

  const handleConfirm = () => {
    if (!item) return

    const reason = selectedReason || customReason.trim() || null
    const refundCents = parseDollars(refundValue)

    mutation.mutate({
      itemId: item.id,
      destination,
      refundCents,
      reason,
    })
  }

  const handleReasonClick = (value: string) => {
    setSelectedReason(value)
    setCustomReason("")
  }

  const handleCustomReasonChange = (value: string) => {
    setCustomReason(value)
    setSelectedReason(null)
  }

  if (!item) return null

  const title = isGifted ? "Undo gift" : "Undo purchase"
  const description = isGifted
    ? `Move "${item.title}" back from gifted status?`
    : `Move "${item.title}" back from purchased status?`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}
        >
          <div className="space-y-6 py-4">
            {/* Destination choice */}
            <div className="space-y-2">
              <Label>Move item to</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDestination("wishlist")}
                  className={cn(
                    "flex-1 rounded-md border px-4 py-2 text-sm transition-colors",
                    destination === "wishlist"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  Wishlist
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("archive")}
                  className={cn(
                    "flex-1 rounded-md border px-4 py-2 text-sm transition-colors",
                    destination === "archive"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  Archive
                </button>
              </div>
            </div>

            {/* Refund amount */}
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund to budget</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="refund-amount"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  value={refundValue}
                  onChange={(e) => setRefundValue(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Original price: ${formatCents(item.price_cents)}. Enter 0 for no
                refund.
              </p>
            </div>

            {/* Reason selection (optional) */}
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <div className="flex flex-wrap gap-2">
                {UNDO_REASONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleReasonClick(option.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                      "border",
                      selectedReason === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {selectedReason === option.value && (
                      <Check className="h-3 w-3" />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom reason input */}
              <div className="pt-2">
                <Input
                  placeholder="Or type your own reason..."
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  enterKeyHint="done"
                  value={customReason}
                  onChange={(e) => handleCustomReasonChange(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Undoing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
