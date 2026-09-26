import { Filter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface FilterButtonProps {
  activeCount: number
  onClick: () => void
}

/**
 * Button that opens the filter sheet.
 * Shows a badge with the count of active filters.
 */
export function FilterButton({ activeCount, onClick }: FilterButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="relative">
      <Filter className="h-4 w-4" />
      {activeCount > 0 && (
        <Badge
          variant="secondary"
          className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs"
        >
          {activeCount}
        </Badge>
      )}
    </Button>
  )
}
