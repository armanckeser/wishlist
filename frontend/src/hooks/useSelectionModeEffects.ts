import { useEffect } from "react"
import { useSelection } from "@/contexts/SelectionContext"

interface UseSelectionModeEffectsOptions {
  selectedItemId: string | undefined
}

/**
 * Encapsulates selection mode side effects:
 * - Opening drawer exits selection mode
 * - Escape key exits selection mode
 */
export function useSelectionModeEffects({
  selectedItemId,
}: UseSelectionModeEffectsOptions) {
  const { isSelectionMode, exitSelectionMode } = useSelection()

  // Exit selection mode when drawer opens
  useEffect(() => {
    if (selectedItemId && isSelectionMode) exitSelectionMode()
  }, [selectedItemId, isSelectionMode, exitSelectionMode])

  // Escape exits selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) exitSelectionMode()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isSelectionMode, exitSelectionMode])

  return { isSelectionMode }
}
