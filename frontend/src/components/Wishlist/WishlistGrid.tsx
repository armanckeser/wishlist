import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface WishlistGridProps {
  children: ReactNode
  className?: string
  /** Gap between items in pixels or CSS value */
  gap?: number | string
  /** Minimum column width in pixels */
  minColumnWidth?: number
}

/**
 * Responsive 2-column grid for wishlist items.
 * Uses CSS grid with auto-fill for responsive columns.
 */
export function WishlistGrid({
  children,
  className,
  gap = 16,
  minColumnWidth = 160,
}: WishlistGridProps) {
  const gapValue = typeof gap === "number" ? `${gap}px` : gap

  return (
    <div
      className={cn("wishlist-grid", className)}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
        gap: gapValue,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  )
}
