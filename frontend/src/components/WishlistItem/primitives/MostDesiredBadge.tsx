import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface MostDesiredBadgeProps {
  className?: string
}

/**
 * Badge indicating an item is the user's most desired.
 * Uses gold styling consistent with other most desired indicators.
 * Only renders for wishlisted items with is_most_desired=true.
 */
export function MostDesiredBadge({ className }: MostDesiredBadgeProps) {
  const { item } = useWishlistItem()

  if (!item.is_most_desired || item.status !== "wishlisted") return null

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-amber-600",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current" />
      <span className="text-[9px] font-medium uppercase tracking-[0.15em]">
        Most Desired
      </span>
    </div>
  )
}
