import { useCallback, useState } from "react"

export interface DialogPairState<T> {
  /** The item currently associated with the dialog */
  item: T | null
  /** Whether the dialog is open */
  open: boolean
  /** Open the dialog with an item */
  openWith: (item: T) => void
  /** Close the dialog and clear the item */
  close: () => void
  /** Handler for dialog's onOpenChange prop */
  onOpenChange: (open: boolean) => void
}

/**
 * Hook for managing dialog state that's paired with an item.
 * Common pattern for edit/delete dialogs that need to track which item.
 */
export function useDialogPair<T>(): DialogPairState<T> {
  const [item, setItem] = useState<T | null>(null)
  const [open, setOpen] = useState(false)

  const openWith = useCallback((newItem: T) => {
    setItem(newItem)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setItem(null)
  }, [])

  const onOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setOpen(false)
      setItem(null)
    }
  }, [])

  return { item, open, openWith, close, onOpenChange }
}
