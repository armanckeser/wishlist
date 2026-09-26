import { useCallback, useEffect, useRef } from "react"

/**
 * How far a pointer may drift before the gesture counts as a scroll rather
 * than a press. Matches the slop browsers use for their own tap detection.
 */
const MOVE_THRESHOLD_PX = 10

interface UseLongPressOptions {
  /** Duration in ms before long-press triggers (default: 500) */
  duration?: number
  /** Whether long-press is enabled (default: true) */
  enabled?: boolean
  /** Callback when long-press triggers */
  onLongPress: () => void
  /**
   * Optional progress callback fired via requestAnimationFrame during press.
   * Receives a 0..1 ratio of elapsed/duration. Fires once more at 1 on trigger,
   * and once at 0 on cancel/release before threshold.
   */
  onProgress?: (ratio: number) => void
}

interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerLeave: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onClick: (e: React.MouseEvent) => void
}

/**
 * Long-press gesture detection that survives a scrolling finger.
 *
 * Touching an element is how you start scrolling a list, so a press only
 * counts while the finger stays put: any drift past a few pixels, any scroll
 * of an ancestor, or a gesture the browser takes over for panning cancels
 * both the hold timer and the tap that would otherwise follow.
 *
 * Activation is left to the platform's own `click` event rather than
 * synthesized on pointerup. Browsers already suppress a click that ended a
 * scroll; iOS Safari in particular still delivers `pointerup` after a pan,
 * so treating that as a tap is what makes lists open items as you scroll
 * them. The returned `onClick` only *consumes* clicks that shouldn't count
 * (it calls `preventDefault`, so callers can check `defaultPrevented`).
 */
export function useLongPress({
  duration = 500,
  enabled = true,
  onLongPress,
  onProgress,
}: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const didLongPressRef = useRef(false)
  const didMoveRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  const stopProgress = useCallback((finalRatio: number | null) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (finalRatio !== null && onProgressRef.current) {
      onProgressRef.current(finalRatio)
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // A scroll anywhere up the tree means the finger is panning, not pressing.
  // Some browsers (notably iOS Safari) are unreliable about firing
  // pointercancel when they take a gesture over for scrolling, so this is
  // what makes "scroll with a finger on a card" behave the same everywhere.
  // Only armed while a gesture is in flight - a long list is a lot of cards
  // to have listening to every scroll.
  const scrollGuardRef = useRef<(() => void) | null>(null)

  const disarmScrollGuard = useCallback(() => {
    if (scrollGuardRef.current) {
      window.removeEventListener("scroll", scrollGuardRef.current, true)
      scrollGuardRef.current = null
    }
  }, [])

  /** Give up on the current gesture: no long-press, and no tap either. */
  const abort = useCallback(() => {
    disarmScrollGuard()
    if (startPointRef.current === null) return
    startPointRef.current = null
    didMoveRef.current = true
    clearTimer()
    stopProgress(0)
  }, [clearTimer, stopProgress, disarmScrollGuard])

  const armScrollGuard = useCallback(() => {
    disarmScrollGuard()
    const onScroll = () => abort()
    scrollGuardRef.current = onScroll
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    })
  }, [abort, disarmScrollGuard])

  useEffect(() => disarmScrollGuard, [disarmScrollGuard])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Right-click and other secondary buttons aren't presses.
      if (e.pointerType === "mouse" && e.button !== 0) return

      // Tracked even with long-press off: the veto on taps that were really
      // scrolls has to hold in every mode, not only while a hold is armed.
      didLongPressRef.current = false
      didMoveRef.current = false
      startPointRef.current = { x: e.clientX, y: e.clientY }
      startedAtRef.current = performance.now()
      armScrollGuard()

      if (!enabled) return

      if (onProgressRef.current) {
        const tick = () => {
          const elapsed = performance.now() - startedAtRef.current
          const ratio = Math.min(1, elapsed / duration)
          onProgressRef.current?.(ratio)
          if (ratio < 1) {
            rafRef.current = requestAnimationFrame(tick)
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true
        stopProgress(1)

        // Haptic feedback (mobile)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }

        onLongPress()
      }, duration)
    },
    [enabled, duration, onLongPress, stopProgress, armScrollGuard],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startPointRef.current
      if (!start) return
      const distance = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (distance > MOVE_THRESHOLD_PX) {
        abort()
      }
    },
    [abort],
  )

  const handlePointerUp = useCallback(() => {
    clearTimer()
    disarmScrollGuard()
    startPointRef.current = null
    stopProgress(didLongPressRef.current ? null : 0)
  }, [clearTimer, stopProgress, disarmScrollGuard])

  const handlePointerLeave = useCallback(() => abort(), [abort])

  const handlePointerCancel = useCallback(() => abort(), [abort])

  // Prevent browser context menu on long-press (mobile shows "Copy Image", etc.)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (enabled) {
        e.preventDefault()
      }
    },
    [enabled],
  )

  // Swallow the click that follows a long-press or a scrolling finger.
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didLongPressRef.current || didMoveRef.current) {
      e.preventDefault()
      e.stopPropagation()
      didLongPressRef.current = false
      didMoveRef.current = false
    }
  }, [])

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    onPointerCancel: handlePointerCancel,
    onContextMenu: handleContextMenu,
    onClick: handleClick,
  }
}
