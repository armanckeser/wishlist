import { Check, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"
import { BoughtDialog } from "./BoughtDialog"

const EARNED_IT_MESSAGES = [
  "You earned this! Enjoy it.",
  "Well deserved. You waited patiently.",
  "Congratulations on your thoughtful purchase!",
  "You did it the right way. Enjoy!",
  "Patience paid off. It's all yours!",
]

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
}

interface BuyButtonProps {
  className?: string
}

/**
 * Button to mark item as purchased.
 * Opens BoughtDialog to collect optional tracking info before purchase.
 * Only renders if onBuy action is provided.
 * Shows celebration message for ready-to-treat items.
 * Most desired items get a special gold sparkling style.
 */
export function BuyButton({ className }: BuyButtonProps) {
  const { item, isReadyToTreat, actions } = useWishlistItem()
  const { onBuy } = actions
  const [dialogOpen, setDialogOpen] = useState(false)

  // Don't render if no buy action
  if (!onBuy) {
    return null
  }

  const isMostDesired = item.is_most_desired

  const handleClick = () => {
    setDialogOpen(true)
  }

  const handleConfirm = (data: {
    trackingUrl?: string
    actualPricePaidCents?: number
    trackingNumber?: string
    trackingCarrier?: string
  }) => {
    if (isReadyToTreat) {
      toast.success(getRandomMessage(EARNED_IT_MESSAGES))
    }
    onBuy(item, data)
    setDialogOpen(false)
  }

  // Golden styling for most desired items
  const button =
    isMostDesired && isReadyToTreat ? (
      <Button
        className={cn(
          "h-12 flex-1 relative overflow-hidden",
          "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500",
          "hover:from-amber-600 hover:via-yellow-500 hover:to-amber-600",
          "text-amber-950 font-semibold",
          "border-0 shadow-lg shadow-amber-500/25",
          "golden-shimmer",
          className,
        )}
        onClick={handleClick}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Claim Your Prize
      </Button>
    ) : (
      <Button className={cn("h-12 flex-1", className)} onClick={handleClick}>
        <Check className="mr-2 h-4 w-4" />
        {isReadyToTreat ? "Bought!" : "Mark as Bought"}
      </Button>
    )

  return (
    <>
      {button}
      <BoughtDialog
        item={item}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirm}
      />
    </>
  )
}
