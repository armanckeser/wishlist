import { Archive, Check, ExternalLink } from "lucide-react"
import { useState } from "react"

import { SetbackWarningDialog } from "@/components/MostDesired"
import { Button } from "@/components/ui/button"
import { useMostDesiredOptional } from "@/contexts/MostDesiredContext"

import { useWishlistItem } from "../../context"
import { BoughtDialog } from "./BoughtDialog"

/**
 * Action buttons for ready-to-treat items.
 * Two-column grid: Archive | [Link icon + Bought!]
 * Only renders for ready-to-treat, non-purchased items when user can buy.
 */
export function ReadyActions() {
  const { item, isReadyToTreat, isPurchased, close, actions } =
    useWishlistItem()
  const { onBuy, onArchive } = actions
  const mostDesired = useMostDesiredOptional()
  const [warningOpen, setWarningOpen] = useState(false)
  const [boughtDialogOpen, setBoughtDialogOpen] = useState(false)

  // Only show for owners with ready-to-treat, non-purchased items
  if (!onBuy || isPurchased || !isReadyToTreat) {
    return null
  }

  // Show warning if most desired exists and this isn't the most desired item
  const shouldShowWarning =
    mostDesired?.mostDesiredItem && item.id !== mostDesired.mostDesiredItem.id

  const handleViewOnSite = () => {
    if (!item.product_url) return

    if (shouldShowWarning) {
      setWarningOpen(true)
    } else {
      window.open(item.product_url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            onArchive?.(item)
            close?.()
          }}
          disabled={!onArchive}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </Button>

        {/* Merged button: external link icon | Bought! */}
        <div className="flex h-12 overflow-hidden rounded-md">
          <Button
            className="h-full rounded-none rounded-l-md border-r border-primary-foreground/20 px-3"
            onClick={handleViewOnSite}
            disabled={!item.product_url}
            aria-label="View on site"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            className="h-full flex-1 rounded-none rounded-r-md"
            onClick={() => setBoughtDialogOpen(true)}
          >
            <Check className="mr-2 h-4 w-4" />
            Bought!
          </Button>
        </div>
      </div>

      <BoughtDialog
        item={item}
        open={boughtDialogOpen}
        onOpenChange={setBoughtDialogOpen}
        onConfirm={(data) => {
          onBuy?.(item, data)
          setBoughtDialogOpen(false)
          close?.()
        }}
      />

      {shouldShowWarning && mostDesired?.mostDesiredItem && (
        <SetbackWarningDialog
          open={warningOpen}
          onOpenChange={setWarningOpen}
          itemTitle={item.title}
          itemPriceCents={item.price_cents}
          mostDesiredItemTitle={mostDesired.mostDesiredItem.title}
          daysSetback={mostDesired.getDaysSetback(item.price_cents)}
          productUrl={item.product_url ?? ""}
        />
      )}
    </>
  )
}
