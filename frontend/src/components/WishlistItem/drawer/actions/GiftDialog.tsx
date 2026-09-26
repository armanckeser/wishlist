import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { WishlistItemPublic } from "@/types"
import { formatPrice } from "../../utils"

interface GiftDialogProps {
  item: WishlistItemPublic
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: {
    giftMessage?: string
    gifterDisplayName?: string
    trackingUrl?: string
  }) => void
  isPending?: boolean
}

/**
 * Dialog shown when gifting an item from someone's wishlist.
 * Allows gifter to add optional message, display name, and tracking URL.
 */
export function GiftDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: GiftDialogProps) {
  const [giftMessage, setGiftMessage] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)

  const handleConfirm = () => {
    onConfirm({
      giftMessage: giftMessage.trim() || undefined,
      gifterDisplayName: isAnonymous
        ? undefined
        : displayName.trim() || undefined,
      trackingUrl: trackingUrl.trim() || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setGiftMessage("")
      setDisplayName("")
      setTrackingUrl("")
      setIsAnonymous(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gift This Item</DialogTitle>
          <DialogDescription>
            You're gifting{" "}
            <span className="font-medium text-foreground">{item.title}</span> ($
            {formatPrice(item.price_cents)}) to the wishlist owner.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Display name */}
          <div className="grid gap-2">
            <Label htmlFor="display-name">Your name (optional)</Label>
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Enter your name"
              disabled={isAnonymous}
              className={isAnonymous ? "opacity-50" : ""}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked === true)}
              />
              <label
                htmlFor="anonymous"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Gift anonymously
              </label>
            </div>
          </div>

          {/* Gift message */}
          <div className="grid gap-2">
            <Label htmlFor="gift-message">Personal message (optional)</Label>
            <Input
              id="gift-message"
              type="text"
              value={giftMessage}
              onChange={(event) => setGiftMessage(event.target.value)}
              placeholder="Add a personal note..."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              A short message to accompany your gift
            </p>
          </div>

          {/* Tracking URL */}
          <div className="grid gap-2">
            <Label htmlFor="tracking-url">Tracking URL (optional)</Label>
            <Input
              id="tracking-url"
              type="url"
              value={trackingUrl}
              onChange={(event) => setTrackingUrl(event.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Share shipping tracking with the recipient
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Sending..." : "Send Gift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
