import { useCallback, useEffect, useState } from "react"
import {
  WHATS_NEW_VERSION,
  type WhatsNewContent,
  whatsNewContent,
} from "@/config/whats-new"

const STORAGE_KEY = "lastSeenWhatsNewVersion"

export interface UseWhatsNewResult {
  /** Whether the drawer should be shown */
  isOpen: boolean
  /** The content to display */
  content: WhatsNewContent
  /** Current version */
  version: string
  /** Open the drawer manually */
  open: () => void
  /** Dismiss the drawer and save the version to localStorage */
  dismiss: () => void
}

/**
 * Hook for managing "What's New" drawer visibility.
 *
 * Shows the drawer when:
 * - First install (no stored version)
 * - Version has changed since last seen
 */
export function useWhatsNew(): UseWhatsNewResult {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(STORAGE_KEY)

    if (lastSeenVersion !== WHATS_NEW_VERSION) {
      setIsOpen(true)
    }
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const dismiss = useCallback(() => {
    setIsOpen(false)
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
  }, [])

  return {
    isOpen,
    content: whatsNewContent,
    version: WHATS_NEW_VERSION,
    open,
    dismiss,
  }
}
