import { useEffect, useMemo, useRef, useState } from "react"

import { type ParseUrlResponse, UrlParserService } from "@/client"
import { isUsefulParseResult } from "@/utils/parseValidation"

export interface ClipboardUrlPrefill {
  url: string
  parsed: ParseUrlResponse
}

interface UseClipboardUrlPrefillOptions {
  enabled: boolean
  existingUrls: string[]
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

export function useClipboardUrlPrefill({
  enabled,
  existingUrls,
  skip = false,
}: UseClipboardUrlPrefillOptions) {
  const [prefill, setPrefill] = useState<ClipboardUrlPrefill | null>(null)
  const hasCheckedRef = useRef(false)

  const normalizedExistingUrls = useMemo(() => {
    const normalized = existingUrls
      .map((url) => normalizeUrl(url))
      .filter((url): url is string => Boolean(url))
    return new Set(normalized)
  }, [existingUrls])

  useEffect(() => {
    if (!enabled || skip || prefill || hasCheckedRef.current) return
    if (typeof navigator === "undefined") return
    if (!navigator.clipboard?.readText) return

    hasCheckedRef.current = true

    const checkClipboard = async () => {
      try {
        const clipboardText = await navigator.clipboard.readText()
        const candidateUrl = extractUrl(clipboardText)
        if (!candidateUrl) return

        const normalizedCandidate = normalizeUrl(candidateUrl)
        if (
          !normalizedCandidate ||
          normalizedExistingUrls.has(normalizedCandidate)
        )
          return

        const result = await UrlParserService.parseProductUrl({
          requestBody: { url: candidateUrl },
        })

        if (!isUsefulParseResult(result)) return

        setPrefill({
          url: result.source_url ?? candidateUrl,
          parsed: result,
        })
      } catch {
        // Clipboard access is best-effort. Ignore if not allowed.
      }
    }

    void checkClipboard()
  }, [enabled, skip, prefill, normalizedExistingUrls])

  const clear = () => {
    setPrefill(null)
  }

  return { prefill, clear }
}
