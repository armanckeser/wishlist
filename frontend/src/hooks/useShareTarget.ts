import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import {
  serializeViewState,
  type WishlistViewState,
} from "@/components/Wishlist"

interface ShareTargetParams {
  share?: string
  title?: string
  text?: string
  url?: string
}

interface ShareTargetState {
  /** The shared URL to pre-fill in the add dialog */
  url: string | undefined
  /** Whether the add dialog should be open */
  isOpen: boolean
  /** Close the dialog and clear the URL */
  close: () => void
  /** Handler for dialog's onOpenChange prop */
  onOpenChange: (open: boolean) => void
}

/**
 * Extract URL from share target params.
 * Some apps share URL in the `url` param, others in `text`.
 */
function extractUrlFromShareParams(
  params: ShareTargetParams,
): string | undefined {
  // First try the explicit url param
  if (params.url) {
    return params.url
  }

  // Some apps put the URL in text - try to extract it
  if (params.text) {
    // Check if text is a URL itself
    if (
      params.text.startsWith("http://") ||
      params.text.startsWith("https://")
    ) {
      return params.text
    }

    // Try to find a URL in the text
    const urlMatch = params.text.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      return urlMatch[0]
    }
  }

  return undefined
}

/**
 * Hook for handling PWA share target functionality.
 * Captures the shared URL from search params and manages add dialog state.
 */
export function useShareTarget(
  shareParams: ShareTargetParams,
  viewState: WishlistViewState,
  selectedItemId: string | undefined,
): ShareTargetState {
  const navigate = useNavigate()

  // Check if this is a share (either explicit flag or any share params present)
  const isShare =
    shareParams.share === "true" ||
    Boolean(shareParams.url) ||
    Boolean(shareParams.text)

  // Extract URL from params
  const sharedUrl = extractUrlFromShareParams(shareParams)

  // Debug logging in development
  if (import.meta.env.DEV && isShare) {
    console.log("[ShareTarget] Received share:", {
      share: shareParams.share,
      title: shareParams.title,
      text: shareParams.text,
      url: shareParams.url,
      extractedUrl: sharedUrl,
    })
  }

  // Capture URL at mount, then clear from URL params
  const [url, setUrl] = useState<string | undefined>(() => sharedUrl)
  const [isOpen, setIsOpen] = useState(() => Boolean(sharedUrl))

  // Clear URL param after capturing (keeps URL clean)
  useEffect(() => {
    if (isShare) {
      navigate({
        to: "/",
        search: serializeViewState(viewState, selectedItemId),
        replace: true,
      })
    }
  }, [isShare, navigate, selectedItemId, viewState])

  const close = () => {
    setIsOpen(false)
    setUrl(undefined)
  }

  const onOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setUrl(undefined)
    }
  }

  return { url, isOpen, close, onOpenChange }
}
