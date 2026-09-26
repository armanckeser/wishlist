import type { ArchivedItemPublic } from "@/client"

import { formatRelativeTime } from "../../utils"

interface ArchivedInfoProps {
  item: ArchivedItemPublic
  daysWishlisted: number
}

/**
 * Info display for archived items.
 * Shows when item was added and when it was archived.
 */
export function ArchivedInfo({ item, daysWishlisted }: ArchivedInfoProps) {
  const formatAddedText = (days: number): string => {
    const relative = formatRelativeTime(days)
    return relative === "today" ? "Added today" : `Added ${relative} ago`
  }

  return (
    <div className="space-y-1 pt-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
        {formatAddedText(daysWishlisted)}
      </p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
        Archived {new Date(item.archived_at).toLocaleDateString()}
      </p>
    </div>
  )
}
