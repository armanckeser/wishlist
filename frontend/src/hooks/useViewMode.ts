import { useEffect, useState } from "react"

export type ViewMode = "grid" | "list"

const VIEW_MODE_STORAGE_KEY = "wishlist-view-mode"

/**
 * Hook that provides persisted view mode state.
 * Stores preference in localStorage and syncs across tabs.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    return stored === "list" ? "list" : "grid"
  })

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  }, [viewMode])

  return [viewMode, setViewMode]
}
