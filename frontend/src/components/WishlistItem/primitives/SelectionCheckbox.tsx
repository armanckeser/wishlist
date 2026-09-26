import { cn } from "@/lib/utils"

import { useWishlistItem } from "../context"

interface SelectionCheckboxProps {
  className?: string
  /** Position variant */
  position?: "overlay" | "inline"
}

/**
 * Selection checkbox for multi-select mode.
 * Only renders when selection mode is active.
 * Visual-only - parent handles click events.
 */
export function SelectionCheckbox({
  className,
  position = "overlay",
}: SelectionCheckboxProps) {
  const { selection, isSelected } = useWishlistItem()

  const isSelectionMode = selection?.isSelectionMode ?? false

  if (!isSelectionMode) return null

  const checkbox = (
    <div
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-sm border-2",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : position === "overlay"
            ? "border-white bg-black/30"
            : "border-muted-foreground/50 bg-transparent",
      )}
    >
      {isSelected && (
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </div>
  )

  if (position === "overlay") {
    return (
      <div
        className={cn("pointer-events-none absolute right-2 top-2", className)}
      >
        {checkbox}
      </div>
    )
  }

  return (
    <div className={cn("pointer-events-none flex-shrink-0", className)}>
      {checkbox}
    </div>
  )
}
