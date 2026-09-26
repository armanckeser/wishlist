import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

const STORAGE_KEY = "wishlist-recent-categories"
const MAX_RECENT = 10

interface RecentCategoriesContextValue {
  /** Most recently used category IDs, ordered by recency (most recent first) */
  recentIds: string[]
  /** Add a category ID to the recent list (moves to front if already present) */
  addRecent: (id: string) => void
  /** Remove IDs that no longer exist (call after fetching categories) */
  cleanupStaleIds: (validIds: Set<string>) => void
}

const RecentCategoriesContext = createContext<
  RecentCategoriesContextValue | undefined
>(undefined)

function loadFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === "string")
      }
    }
  } catch {
    // Invalid JSON, ignore
  }
  return []
}

function saveToStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage full or unavailable, ignore
  }
}

export function RecentCategoriesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [recentIds, setRecentIds] = useState<string[]>(loadFromStorage)

  // Persist to localStorage when recentIds changes
  useEffect(() => {
    saveToStorage(recentIds)
  }, [recentIds])

  const addRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      // Remove if already present, then add to front
      const filtered = prev.filter((existingId) => existingId !== id)
      const updated = [id, ...filtered].slice(0, MAX_RECENT)
      return updated
    })
  }, [])

  const cleanupStaleIds = useCallback((validIds: Set<string>) => {
    setRecentIds((prev) => {
      const cleaned = prev.filter((id) => validIds.has(id))
      // Only update if something was removed
      return cleaned.length === prev.length ? prev : cleaned
    })
  }, [])

  const value = useMemo(
    () => ({ recentIds, addRecent, cleanupStaleIds }),
    [recentIds, addRecent, cleanupStaleIds],
  )

  return (
    <RecentCategoriesContext.Provider value={value}>
      {children}
    </RecentCategoriesContext.Provider>
  )
}

export function useRecentCategories(): RecentCategoriesContextValue {
  const context = useContext(RecentCategoriesContext)
  if (!context) {
    throw new Error(
      "useRecentCategories must be used within a RecentCategoriesProvider",
    )
  }
  return context
}
