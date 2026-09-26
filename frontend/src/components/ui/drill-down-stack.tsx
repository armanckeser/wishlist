import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Two-pane drill-down stack with native scroll-snap.
 *
 * Why scroll-snap and not transform animation: the user's finger drives the
 * panel position natively, with browser-supplied momentum and interruption.
 * iOS-feeling swipe-back is free; no pointer-event JS needed.
 *
 * Layout: a horizontal grid with two columns, each 100% wide, in a
 * mandatory-snap scroller. Index 0 = root, index 1 = drilled-in panel.
 */

interface DrillDownStackProps {
  /** Currently active pane index (0 = root, 1 = drill-down) */
  activeIndex: 0 | 1
  /** Called when user swipes to another pane (the snap settled there) */
  onActiveIndexChange: (index: 0 | 1) => void
  /** Root pane content (the form) */
  root: React.ReactNode
  /** Drill-down pane content (the picker) */
  drillDown: React.ReactNode
  className?: string
}

export function DrillDownStack({
  activeIndex,
  onActiveIndexChange,
  root,
  drillDown,
  className,
}: DrillDownStackProps) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null)
  // Skip the next scrollsnapchange that we trigger ourselves via scrollTo —
  // otherwise programmatic moves would round-trip back into onActiveIndexChange.
  const programmaticRef = React.useRef(false)

  // Drive scroll position from prop changes. Use scrollTo with behavior: 'auto'
  // so the CSS scroll-behavior (smooth unless reduced-motion) applies.
  React.useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const targetLeft = activeIndex * scroller.clientWidth
    if (Math.abs(scroller.scrollLeft - targetLeft) < 1) return
    programmaticRef.current = true
    scroller.scrollTo({ left: targetLeft, behavior: "auto" })
  }, [activeIndex])

  // Use scrollsnapchange when available (Chrome 129+, Safari 18.2+).
  // It fires once after the snap commits — no scroll event polling needed.
  React.useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const handleSnap = () => {
      if (programmaticRef.current) {
        programmaticRef.current = false
        return
      }
      const idx = Math.round(scroller.scrollLeft / scroller.clientWidth)
      const clamped = (idx === 1 ? 1 : 0) as 0 | 1
      if (clamped !== activeIndex) onActiveIndexChange(clamped)
    }

    if ("onscrollsnapchange" in scroller) {
      scroller.addEventListener("scrollsnapchange", handleSnap as EventListener)
      return () =>
        scroller.removeEventListener(
          "scrollsnapchange",
          handleSnap as EventListener,
        )
    }

    // Fallback: scrollend (Safari ≤18.1, older browsers)
    const handleScrollEnd = () => handleSnap()
    scroller.addEventListener("scrollend", handleScrollEnd)
    return () => scroller.removeEventListener("scrollend", handleScrollEnd)
  }, [activeIndex, onActiveIndexChange])

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "drill-down-stack",
        // Two full-width columns, horizontal snap, no scrollbar.
        "grid w-full grid-flow-col auto-cols-[100%] overflow-x-auto overflow-y-hidden",
        // mandatory: always settle fully on a pane
        "snap-x snap-mandatory",
        // Stop swipe from chaining into outer drawer / page scroll
        "overscroll-x-none",
        // Hide horizontal scrollbar
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        // Smooth programmatic scroll, gated on user motion preference via global rule below
        className,
      )}
    >
      <div
        className={cn(
          "snap-start [scroll-snap-stop:always]",
          // Each pane scrolls its own content vertically.
          // scroll-padding-bottom ensures iOS Safari has room to scroll the
          // focused input above the on-screen keyboard via its native
          // auto-scroll behavior (no JS keyboard math required).
          "h-full overflow-y-auto overscroll-contain [scroll-padding-bottom:40dvh]",
          // Hidden when not active so its content cannot be tabbed into
          activeIndex !== 0 && "pointer-events-none",
        )}
        aria-hidden={activeIndex !== 0}
        // inert is the proper way to remove a subtree from focus / AT
        // when not the active pane
        {...(activeIndex !== 0 ? { inert: true } : {})}
      >
        {root}
      </div>
      <div
        className={cn(
          "snap-start [scroll-snap-stop:always]",
          "h-full overflow-y-auto overscroll-contain [scroll-padding-bottom:40dvh]",
          activeIndex !== 1 && "pointer-events-none",
        )}
        aria-hidden={activeIndex !== 1}
        {...(activeIndex !== 1 ? { inert: true } : {})}
      >
        {drillDown}
      </div>
    </div>
  )
}
