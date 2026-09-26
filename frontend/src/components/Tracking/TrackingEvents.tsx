"use client"

import { useEffect, useRef, useState } from "react"

import type { TrackingEventPublic } from "@/client"
import { cn } from "@/lib/utils"

interface TrackingEventsProps {
  events: TrackingEventPublic[]
  className?: string
  maxVisibleEvents?: number
}

/**
 * Format event timestamp as "Jan 23 11:40 AM"
 */
function formatEventTime(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return ""
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/**
 * Scrollable list of tracking events with blur edges.
 * Shows 3 events at a time with scroll indicators.
 */
export function TrackingEvents({
  events,
  className,
  maxVisibleEvents = 3,
}: TrackingEventsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const checkScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setCanScrollUp(scrollTop > 4)
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 4)
    }

    checkScroll()
    container.addEventListener("scroll", checkScroll)
    return () => container.removeEventListener("scroll", checkScroll)
  }, [])

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tracking updates yet</p>
    )
  }

  const eventHeight = 48
  const maxHeight = eventHeight * maxVisibleEvents

  return (
    <div className={cn("relative", className)}>
      {/* Top blur/fade when can scroll up */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent transition-opacity duration-200",
          canScrollUp ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="space-y-0">
          {events.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className={cn(
                "flex gap-3 py-2",
                index !== events.length - 1 && "border-b border-border/40",
              )}
              style={{ minHeight: `${eventHeight}px` }}
            >
              {/* Timestamp */}
              <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatEventTime(event.timestamp)}
              </span>

              {/* Description and location */}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{event.description}</p>
                {event.location && (
                  <p className="text-xs text-muted-foreground truncate">
                    {event.location}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom blur/fade when can scroll down */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent transition-opacity duration-200",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  )
}

export default TrackingEvents
