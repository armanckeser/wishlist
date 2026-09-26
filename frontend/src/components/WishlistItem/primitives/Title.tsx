import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface TitleProps {
  className?: string
  /** Number of lines to clamp, defaults to 1 */
  lineClamp?: 1 | 2
}

/**
 * Product title display.
 * Supports line clamping for card/row layouts.
 */
export function Title({ className, lineClamp = 1 }: TitleProps) {
  const { item } = useWishlistItem()

  return (
    <h3
      className={cn(
        "font-medium leading-snug text-foreground",
        lineClamp === 1 && "line-clamp-1",
        lineClamp === 2 && "line-clamp-2",
        className,
      )}
    >
      {item.title}
    </h3>
  )
}
