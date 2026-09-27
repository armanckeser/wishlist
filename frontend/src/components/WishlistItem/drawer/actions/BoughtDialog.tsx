import { Check, Loader2, RefreshCw } from "lucide-react"
import { useCallback, useState } from "react"
import { type TrackingParseResponse, TrackingService } from "@/client"
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
import type { WishlistItemPublic } from "@/types"
import { formatPrice } from "../../utils"

interface BoughtDialogProps {
  item: WishlistItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: {
    trackingUrl?: string
    actualPricePaidCents?: number
    trackingNumber?: string
    trackingCarrier?: string
  }) => void
  isPending?: boolean
}

/**
 * Dialog shown before marking an item as bought.
 * Allows user to optionally add tracking number and actual price paid.
 */
export function BoughtDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: BoughtDialogProps) {
  const [trackingInput, setTrackingInput] = useState("")
  const [isParsingTracking, setIsParsingTracking] = useState(false)
  const [trackingResult, setTrackingResult] =
    useState<TrackingParseResponse | null>(null)
  const [actualPrice, setActualPrice] = useState(
    (item.price_cents / 100).toFixed(2),
  )
  const { showErrorToast } = useCustomToast()

  // Parse tracking number or URL
  const parseTrackingInput = useCallback(
    async (input: string) => {
      if (!input.trim()) {
        setTrackingResult(null)
        return
      }

      setIsParsingTracking(true)
      try {
        const result = await TrackingService.parseTracking({
          requestBody: { input: input.trim() },
        })
        setTrackingResult(result)
      } catch {
        showErrorToast("Couldn't parse tracking number. Check the format.")
        setTrackingResult(null)
      } finally {
        setIsParsingTracking(false)
      }
    },
    [showErrorToast],
  )

  const handleTrackingInputChange = (value: string) => {
    setTrackingInput(value)
    // Clear result when input changes
    if (trackingResult) {
      setTrackingResult(null)
    }
  }

  const handleTrackingPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text")
    setTimeout(() => {
      parseTrackingInput(pastedText)
    }, 0)
  }

  const handleTrackingBlur = () => {
    if (trackingInput && !trackingResult) {
      parseTrackingInput(trackingInput)
    }
  }

  const handleConfirm = () => {
    const parsedPrice = Number.parseFloat(actualPrice)
    const actualPriceCents = Number.isNaN(parsedPrice)
      ? undefined
      : Math.round(parsedPrice * 100)

    onConfirm({
      trackingUrl: trackingResult?.tracking_url ?? undefined,
      actualPricePaidCents:
        actualPriceCents !== item.price_cents ? actualPriceCents : undefined,
      trackingNumber: trackingResult?.is_valid
        ? trackingResult.tracking_number
        : undefined,
      trackingCarrier: trackingResult?.is_valid
        ? (trackingResult.carrier ?? undefined)
        : undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTrackingInput("")
      setTrackingResult(null)
      setActualPrice((item.price_cents / 100).toFixed(2))
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Bought</DialogTitle>
          <DialogDescription>
            Confirm purchase of{" "}
            <span className="font-medium text-foreground">{item.title}</span>{" "}
            for ${formatPrice(item.price_cents)}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}
        >
          <div className="grid gap-4 py-4">
            {/* Actual price paid */}
            <div className="grid gap-2">
              <Label htmlFor="actual-price">Actual price paid (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="actual-price"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={actualPrice}
                  onChange={(event) => setActualPrice(event.target.value)}
                  placeholder={(item.price_cents / 100).toFixed(2)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                If you paid a different price
              </p>
            </div>

            {/* Tracking Number */}
            <div className="grid gap-2">
              <Label htmlFor="tracking-input">Tracking number (optional)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="tracking-input"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="done"
                    placeholder="Paste tracking number or URL..."
                    value={trackingInput}
                    onChange={(e) => handleTrackingInputChange(e.target.value)}
                    onPaste={handleTrackingPaste}
                    onBlur={handleTrackingBlur}
                    disabled={isParsingTracking}
                    className={
                      trackingResult?.is_valid
                        ? "ring-2 ring-emerald-500 border-emerald-500"
                        : trackingResult && !trackingResult.is_valid
                          ? "ring-2 ring-destructive border-destructive"
                          : undefined
                    }
                  />
                  {isParsingTracking && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {trackingInput && !isParsingTracking && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => parseTrackingInput(trackingInput)}
                    title="Parse tracking number"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {/* Carrier detection result */}
              {trackingResult && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    trackingResult.is_valid
                      ? "text-emerald-600"
                      : "text-destructive"
                  }`}
                >
                  {trackingResult.is_valid ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>
                        {trackingResult.carrier ?? "Carrier"} detected
                      </span>
                    </>
                  ) : (
                    <span>Invalid tracking number format</span>
                  )}
                </div>
              )}
              {!trackingResult && (
                <p className="text-xs text-muted-foreground">
                  Track your order shipment
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Confirming..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
