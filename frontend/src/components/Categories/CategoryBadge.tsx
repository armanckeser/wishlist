import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Generate a deterministic hue from a string.
 * Uses a simple hash to produce consistent colors for the same category.
 */
function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  // Map to a pleasant range of hues (avoiding muddy greens)
  // Ranges: 0-80 (warm reds/oranges/yellows), 200-340 (cool blues/purples/pinks)
  const normalized = Math.abs(hash) % 220
  return normalized < 80 ? normalized : normalized + 120
}

/**
 * Get the color for a category based on its name.
 * Returns an oklch color string.
 */
function getCategoryColor(name: string): string {
  const hue = stringToHue(name)
  // oklch with medium lightness and moderate chroma for visibility
  return `oklch(0.65 0.18 ${hue})`
}

interface CategoryBadgeProps {
  /** Category name to display */
  name: string
  /** Optional callback when remove button is clicked */
  onRemove?: () => void
  /** Size variant */
  size?: "sm" | "md"
  /** Additional className */
  className?: string
}

/**
 * Linear-style category badge with colored circle indicator.
 * Each category gets a unique, consistent color based on its name.
 */
export function CategoryBadge({
  name,
  onRemove,
  size = "md",
  className,
}: CategoryBadgeProps) {
  const color = getCategoryColor(name)

  const sizeClasses = {
    sm: "h-6 px-2 text-xs gap-1.5",
    md: "h-8 px-2.5 text-sm gap-2",
  }

  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card",
        sizeClasses[size],
        className,
      )}
    >
      {/* Color dot */}
      <span
        className={cn("shrink-0 rounded-full", dotSizes[size])}
        style={{ backgroundColor: color }}
      />

      {/* Category text */}
      <span className="text-foreground">{name}</span>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${name}`}
        >
          <X className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      )}
    </div>
  )
}

export { getCategoryColor, stringToHue }
