import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { type ParseUrlResponse, UrlParserService } from "@/client"
import { isUsefulParseResult } from "@/utils/parseValidation"

/**
 * State machine for clipboard URL prefill:
 * - idle: No URL detected, waiting for clipboard check
 * - detecting: Checking clipboard for URL
 * - parsing: URL found, parsing in progress
 * - ready: Parsing complete with useful result
 * - error: Parsing failed or no useful result
 */
export type PrefillState = "idle" | "detecting" | "parsing" | "ready" | "error"

export interface AddItemPrefillContextValue {
  /** Current state of the prefill flow */
  state: PrefillState
  /** The detected/pasted URL */
  url: string | null
  /** Parsed product data when state is 'ready' */
  parsedResult: ParseUrlResponse | null
  /** Whether clipboard API is available (false on iOS without gesture) */
  clipboardAvailable: boolean
  /** Check clipboard for URL - call on mount and on + button click */
  checkClipboard: () => Promise<void>
  /** Start parsing a specific URL (for manual paste) */
  startParsing: (url: string) => Promise<void>
  /** Cancel in-flight parsing and reset */
  cancel: () => void
  /** Clear all state (after successful item creation) */
  clear: () => void
}

const AddItemPrefillContext = createContext<AddItemPrefillContextValue | null>(
  null,
)

interface AddItemPrefillProviderProps {
  children: React.ReactNode
  /** URLs already in the wishlist (to skip duplicates) */
  existingUrls: string[]
  /** Whether prefill is enabled (e.g., only for owners) */
  enabled: boolean
  /** Skip clipboard check (e.g., when share target is active) */
  skip?: boolean
}

const urlPattern = /https?:\/\/[^\s]+/i

const stripTrailingPunctuation = (value: string) =>
  value.replace(/[),.!?]+$/, "")

const trackingParamKeys = new Set([
  "dclid",
  "fbclid",
  "gbraid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "wbraid",
])

const normalizeUrl = (value: string): string | undefined => {
  const cleaned = stripTrailingPunctuation(value.trim())
  if (!cleaned) return undefined

  let parsedUrl: URL
  try {
    parsedUrl = new URL(cleaned)
  } catch {
    return undefined
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase()
  const host = parsedUrl.port ? `${hostname}:${parsedUrl.port}` : hostname
  const normalizedPath =
    parsedUrl.pathname === "/" ? "" : parsedUrl.pathname.replace(/\/$/, "")

  const searchParams = new URLSearchParams(parsedUrl.search)
  for (const key of Array.from(searchParams.keys())) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.startsWith("utm_") || trackingParamKeys.has(lowerKey)) {
      searchParams.delete(key)
    }
  }

  const sortedParams = Array.from(searchParams.entries()).sort(
    ([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB),
  )
  const normalizedSearch =
    sortedParams.length > 0
      ? `?${new URLSearchParams(sortedParams).toString()}`
      : ""

  return `${host}${normalizedPath}${normalizedSearch}`
}

const extractUrl = (text: string): string | undefined => {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return stripTrailingPunctuation(trimmed)
  }
  const match = trimmed.match(urlPattern)
  return match ? stripTrailingPunctuation(match[0]) : undefined
}

export function AddItemPrefillProvider({
  children,
  existingUrls,
  enabled,
  skip = false,
}: AddItemPrefillProviderProps) {
  const [state, setState] = useState<PrefillState>("idle")
  const [url, setUrl] = useState<string | null>(null)
  const [parsedResult, setParsedResult] = useState<ParseUrlResponse | null>(
    null,
  )
  const [clipboardAvailable, setClipboardAvailable] = useState(true)

  const abortControllerRef = useRef<AbortController | null>(null)
  const hasAutoCheckedRef = useRef(false)

  const normalizedExistingUrls = useMemo(() => {
    const normalized = existingUrls
      .map((existingUrl) => normalizeUrl(existingUrl))
      .filter((existingUrl): existingUrl is string => Boolean(existingUrl))
    return new Set(normalized)
  }, [existingUrls])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState("idle")
    setUrl(null)
    setParsedResult(null)
  }, [])

  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState("idle")
    setUrl(null)
    setParsedResult(null)
    // Reset auto-check flag so next mount can check again
    hasAutoCheckedRef.current = false
  }, [])

  const startParsing = useCallback(
    async (candidateUrl: string) => {
      console.log("[Prefill] startParsing called:", candidateUrl)
      // Abort any in-flight request
      if (abortControllerRef.current) {
        console.log("[Prefill] Aborting previous request")
        abortControllerRef.current.abort()
      }

      // Validate URL
      const normalizedCandidate = normalizeUrl(candidateUrl)
      if (!normalizedCandidate) {
        console.log("[Prefill] Invalid URL, state -> error")
        setState("error")
        return
      }

      // Check for duplicates
      if (normalizedExistingUrls.has(normalizedCandidate)) {
        console.log("[Prefill] URL already exists in wishlist, state -> idle")
        setState("idle")
        return
      }

      setState("parsing")
      setUrl(candidateUrl)
      setParsedResult(null)
      console.log("[Prefill] State -> parsing")

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        console.log("[Prefill] Calling parseProductUrl API...")
        const result = await UrlParserService.parseProductUrl({
          requestBody: { url: candidateUrl },
        })
        console.log("[Prefill] API response:", result)

        // Check if cancelled during request
        if (controller.signal.aborted) {
          console.log("[Prefill] Request was aborted")
          return
        }

        if (isUsefulParseResult(result)) {
          console.log("[Prefill] Useful result, state -> ready")
          setUrl(result.source_url ?? candidateUrl)
          setParsedResult(result)
          setState("ready")
        } else {
          console.log("[Prefill] No useful result, state -> error")
          setUrl(null)
          setState("error")
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[Prefill] AbortError (expected)")
          return
        }
        if (controller.signal.aborted) return

        console.log("[Prefill] Parse error:", error)
        setUrl(null)
        setState("error")
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }
    },
    [normalizedExistingUrls],
  )

  const checkClipboard = useCallback(async () => {
    if (!enabled || skip) return
    if (typeof navigator === "undefined") return
    if (!navigator.clipboard?.readText) {
      setClipboardAvailable(false)
      return
    }

    // iOS Safari requires the readText() call to be the *first* async
    // operation in the user-gesture chain. setState before await can break
    // the gesture in standalone PWA mode. Read first, update state second.
    let clipboardText: string
    try {
      clipboardText = await navigator.clipboard.readText()
    } catch {
      // NotAllowedError (user denied / iOS denied silently / no gesture)
      setClipboardAvailable(false)
      setState("idle")
      return
    }

    const candidateUrl = extractUrl(clipboardText)
    if (!candidateUrl) {
      setState("idle")
      return
    }

    setState("detecting")
    await startParsing(candidateUrl)
  }, [enabled, skip, startParsing])

  // Intentionally no auto-check on mount: iOS Safari requires a direct
  // user gesture (button tap) to read the clipboard, and reading at app
  // load triggers the system "Allow Paste" prompt out of context. The
  // explicit Paste button inside the dialog is the only reliable path.

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      state,
      url,
      parsedResult,
      clipboardAvailable,
      checkClipboard,
      startParsing,
      cancel,
      clear,
    }),
    [
      state,
      url,
      parsedResult,
      clipboardAvailable,
      checkClipboard,
      startParsing,
      cancel,
      clear,
    ],
  )

  return (
    <AddItemPrefillContext.Provider value={value}>
      {children}
    </AddItemPrefillContext.Provider>
  )
}

export function useAddItemPrefill(): AddItemPrefillContextValue {
  const context = useContext(AddItemPrefillContext)
  if (!context) {
    throw new Error(
      "useAddItemPrefill must be used within an AddItemPrefillProvider",
    )
  }
  return context
}

/**
 * Optional hook that returns null if not within provider.
 * Useful for components that may or may not be in add item context.
 */
export function useAddItemPrefillOptional(): AddItemPrefillContextValue | null {
  return useContext(AddItemPrefillContext)
}
