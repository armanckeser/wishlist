import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import type { WishlistItemPublic } from "@/types"

export interface SelectionContextValue {
  /** Whether selection mode is active */
  isSelectionMode: boolean
  /** Set of selected item IDs */
  selectedIds: Set<string>
  /** Count of selected items */
  selectedCount: number
  /** Enter selection mode, optionally selecting first item */
  enterSelectionMode: (itemId?: string) => void
  /** Exit selection mode and clear selection */
  exitSelectionMode: () => void
  /** Toggle selection of a single item */
  toggleItem: (itemId: string) => void
  /** Select all provided items (should be filtered items) */
  selectAll: (items: WishlistItemPublic[]) => void
  /** Deselect all items (stays in selection mode) */
  clearSelection: () => void
  /** Check if an item is selected */
  isSelected: (itemId: string) => boolean
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

interface SelectionProviderProps {
  children: React.ReactNode
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedCount = selectedIds.size

  const enterSelectionMode = useCallback((itemId?: string) => {
    setIsSelectionMode(true)
    if (itemId) {
      setSelectedIds(new Set([itemId]))
    }
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggleItem = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((items: WishlistItemPublic[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (itemId: string) => selectedIds.has(itemId),
    [selectedIds],
  )

  const value = useMemo(
    () => ({
      isSelectionMode,
      selectedIds,
      selectedCount,
      enterSelectionMode,
      exitSelectionMode,
      toggleItem,
      selectAll,
      clearSelection,
      isSelected,
    }),
    [
      isSelectionMode,
      selectedIds,
      selectedCount,
      enterSelectionMode,
      exitSelectionMode,
      toggleItem,
      selectAll,
      clearSelection,
      isSelected,
    ],
  )

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider")
  }
  return context
}

/**
 * Optional hook that returns null if not within provider.
 * Useful for components that may or may not be in selection mode.
 */
export function useSelectionOptional(): SelectionContextValue | null {
  return useContext(SelectionContext)
}
