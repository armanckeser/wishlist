import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface BrandProps {
  className?: string
  /** Show separator before brand (e.g., "·") */
  separator?: string
}

/**
 * Brand name extracted from product URL.
 * Returns null if no brand can be extracted.
 */
export function Brand({ className, separator }: BrandProps) {
  const { brand } = useWishlistItem()

  if (!brand) return null

  return (
    <span className={cn("text-muted-foreground", className)}>
      {separator && `${separator} `}
      {brand}
    </span>
  )
}
