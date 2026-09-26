import { Filter } from "lucide-react"

/**
 * Empty state shown when filters return no matching items.
 */
export function NoFilterResults() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Filter className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-display text-xl font-light text-foreground">
        No items match filters
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try adjusting your filters
      </p>
    </div>
  )
}
