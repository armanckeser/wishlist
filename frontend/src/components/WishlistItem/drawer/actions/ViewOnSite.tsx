import { ExternalLink } from "lucide-react"
import { useState } from "react"

import { SetbackWarningDialog } from "@/components/MostDesired"
import { Button } from "@/components/ui/button"
import { useMostDesiredOptional } from "@/contexts/MostDesiredContext"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

interface ViewOnSiteProps {
  className?: string
  /** Render as icon-only button (for merged button groups) */
  iconOnly?: boolean
}

/**
 * Button to open item's product URL in new tab.
 * Shows a warning dialog for ready-to-treat items when a most desired item exists.
 */
export function ViewOnSite({ className, iconOnly = false }: ViewOnSiteProps) {
  const { item, isReadyToTreat, isPurchased, isArchived } = useWishlistItem()
  const mostDesired = useMostDesiredOptional()
  const [warningOpen, setWarningOpen] = useState(false)

  // Should show warning if:
  // - Most desired item exists
  // - Current item is ready to treat (affordable + mature)
  // - Current item is not the most desired item
  // - Item is not purchased or archived
  const shouldShowWarning =
    mostDesired?.mostDesiredItem &&
    isReadyToTreat &&
    !isPurchased &&
    !isArchived &&
    item.id !== mostDesired.mostDesiredItem.id

  const handleClick = () => {
    if (!item.product_url) return

    if (shouldShowWarning) {
      setWarningOpen(true)
    } else {
      window.open(item.product_url, "_blank", "noopener,noreferrer")
    }
  }

  const warningDialog = shouldShowWarning && mostDesired?.mostDesiredItem && (
    <SetbackWarningDialog
      open={warningOpen}
      onOpenChange={setWarningOpen}
      itemTitle={item.title}
      itemPriceCents={item.price_cents}
      mostDesiredItemTitle={mostDesired.mostDesiredItem.title}
      daysSetback={mostDesired.getDaysSetback(item.price_cents)}
      productUrl={item.product_url ?? ""}
    />
  )

  if (iconOnly) {
    return (
      <>
        <Button
          className={cn("h-full px-3", className)}
          onClick={handleClick}
          disabled={!item.product_url}
          aria-label="View on site"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        {warningDialog}
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn("h-12 flex-1", className)}
        onClick={handleClick}
        disabled={!item.product_url}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        View on Site
      </Button>
      {warningDialog}
    </>
  )
}
