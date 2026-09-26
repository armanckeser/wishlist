import { useEffect } from "react"

/**
 * Lock app scrolling while a modal/drawer is open.
 *
 * Locks the app shell's scroll region ([data-app-scroll]), not <body>. The
 * shell keeps html/body permanently unscrollable, so a lock on the body no
 * longer stops anything — the inner region is the only thing that scrolls.
 *
 * Uses a module-level ref counter so nested modals (or stacking on top of
 * Radix's RemoveScroll) don't double-lock and don't unlock prematurely when
 * the inner modal closes. Only the first lock writes the styles; only the
 * last unlock restores them.
 *
 * Setting overflow:hidden on a real overflow container does stop touch
 * scrolling on iOS, which is why this needs neither position:fixed (breaks
 * iOS touch coordinates) nor touch-action:none (swallows drawer drags).
 */
let lockCount = 0
let lockedElement: HTMLElement | null = null
let previousOverflow: string | null = null
let previousOverscrollBehavior: string | null = null

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    if (lockCount === 0) {
      const scroller =
        document.querySelector<HTMLElement>("[data-app-scroll]") ?? null
      if (scroller) {
        lockedElement = scroller
        previousOverflow = scroller.style.overflow
        previousOverscrollBehavior = scroller.style.overscrollBehavior
        scroller.style.overflow = "hidden"
        scroller.style.overscrollBehavior = "none"
      }
    }
    lockCount++

    return () => {
      lockCount--
      if (lockCount === 0 && lockedElement) {
        lockedElement.style.overflow = previousOverflow ?? ""
        lockedElement.style.overscrollBehavior =
          previousOverscrollBehavior ?? ""
        lockedElement = null
        previousOverflow = null
        previousOverscrollBehavior = null
      }
    }
  }, [locked])
}
