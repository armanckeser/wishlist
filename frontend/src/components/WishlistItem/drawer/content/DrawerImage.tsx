import { useState } from "react"

import { cn } from "@/lib/utils"

import { useWishlistItem } from "../../context"

/**
 * Image loading state machine.
 * Replaces multiple booleans with a single discriminated union.
 */
type ImageState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; expanded: boolean }

const INITIAL_STATE: ImageState = { status: "loading" }

/**
 * Expandable product image for drawer.
 * Shows as a thin bar by default, expands to square on tap.
 * Manages its own loading state internally.
 */
export function DrawerImage() {
  const { item, isArchived } = useWishlistItem()
  const [state, setState] = useState<ImageState>(INITIAL_STATE)

  const isLoaded = state.status === "loaded"
  const isError = state.status === "error"
  const isExpanded = state.status === "loaded" && state.expanded

  const handleLoad = () => {
    setState({ status: "loaded", expanded: false })
  }

  const handleError = () => {
    setState({ status: "error" })
  }

  const handleToggleExpand = () => {
    if (state.status === "loaded") {
      setState({ status: "loaded", expanded: !state.expanded })
    }
  }

  // No image or error - show placeholder bar
  if (!item.image_url || isError) {
    return <div className="h-3 w-full rounded-full bg-muted/50" />
  }

  return (
    <button
      type="button"
      onClick={handleToggleExpand}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-muted/50 transition-all duration-300 ease-out",
        isExpanded ? "aspect-square" : "aspect-[2.4/1]",
        isArchived && "grayscale opacity-60",
      )}
      aria-label={isExpanded ? "Collapse image" : "Expand image"}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted-foreground/5" />
      )}

      {/* Product image */}
      <img
        src={item.image_url}
        alt={item.title}
        className={cn(
          "h-full w-full transition-all duration-300",
          isExpanded ? "object-contain p-4" : "object-cover",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Expand hint overlay */}
      {!isExpanded && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/10">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/0 transition-colors hover:text-white/80">
            Tap to expand
          </span>
        </div>
      )}
    </button>
  )
}
