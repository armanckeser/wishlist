import { Share, SquarePlus } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

const OPEN_COUNT_KEY = "pwa_app_opens"
const DISMISSED_AT_KEY = "ios_install_coach_dismissed_at"
const MIN_OPENS_BEFORE_PROMPT = 2
const DISMISS_TTL_DAYS = 30

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  // iPhone/iPad/iPod, plus iPadOS 13+ which reports as Mac with touch
  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  return isIOSDevice
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  if ((navigator as NavigatorWithStandalone).standalone === true) return true
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false
}

function readNumber(key: string): number {
  const raw = localStorage.getItem(key)
  if (!raw) return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function shouldShowCoach(): boolean {
  if (!isIOSSafari() || isStandalone()) return false

  const dismissedAt = readNumber(DISMISSED_AT_KEY)
  if (dismissedAt > 0) {
    const ageMs = Date.now() - dismissedAt
    const ttlMs = DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000
    if (ageMs < ttlMs) return false
  }

  const opens = readNumber(OPEN_COUNT_KEY) + 1
  localStorage.setItem(OPEN_COUNT_KEY, String(opens))
  return opens >= MIN_OPENS_BEFORE_PROMPT
}

/**
 * One-time bottom sheet teaching iOS Safari users how to install the PWA.
 *
 * iOS Safari does NOT fire `beforeinstallprompt`, so users have no native
 * affordance to discover the app is installable. This sheet shows after the
 * second app open, and is dismissed for 30 days when the user taps "Got it".
 *
 * Untestable in DevTools — `navigator.standalone` only exists on real iOS.
 */
export function IOSInstallCoach() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (shouldShowCoach()) {
      setOpen(true)
    }
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
    }
    setOpen(newOpen)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <SquarePlus className="h-6 w-6 text-primary" />
          </div>
          <DrawerTitle className="text-xl">Install Wishlist</DrawerTitle>
          <DrawerDescription>
            Add to your Home Screen for the best experience — full-screen, fast,
            and offline-ready.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-2">
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                1
              </span>
              <span className="flex flex-1 items-center gap-2">
                Tap the
                <Share className="inline h-4 w-4" aria-label="Share" />
                Share button in Safari
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                2
              </span>
              <span className="flex-1">
                Scroll and tap{" "}
                <span className="font-medium">Add to Home Screen</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                3
              </span>
              <span className="flex-1">
                Tap <span className="font-medium">Add</span> — the app will
                appear on your Home Screen
              </span>
            </li>
          </ol>
        </div>

        <DrawerFooter className="pt-4">
          <DrawerClose asChild>
            <Button className="w-full" size="lg">
              Got it
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
