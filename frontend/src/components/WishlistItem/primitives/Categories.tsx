import { getCategoryColor } from "@/components/Categories/CategoryBadge"
import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface CategoriesProps {
  className?: string
  /** Show all categories or just first with count */
  mode?: "compact" | "full"
}

/**
 * Category display with color indicators.
 * Compact mode shows first category with "+N" count.
 * Full mode shows all categories.
 */
export function Categories({ className, mode = "compact" }: CategoriesProps) {
  const { item } = useWishlistItem()

  if (!item.categories || item.categories.length === 0) return null

  if (mode === "compact") {
    const firstCategory = item.categories[0]
    const remaining = item.categories.length - 1

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-muted-foreground",
          className,
        )}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: getCategoryColor(firstCategory.name) }}
        />
        <span className="truncate">
          {firstCategory.name}
          {remaining > 0 && ` +${remaining}`}
        </span>
      </span>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {item.categories.map((category) => (
        <span
          key={category.id}
          className="inline-flex items-center gap-1.5 font-display text-sm font-light text-muted-foreground"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: getCategoryColor(category.name) }}
          />
          {category.name}
        </span>
      ))}
    </div>
  )
}
