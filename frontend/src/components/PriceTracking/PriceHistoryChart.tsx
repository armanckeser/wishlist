import { motion, useReducedMotion } from "motion/react"
import { useCallback, useId, useMemo, useRef, useState } from "react"
import { useResizeObserver } from "usehooks-ts"

import type { PricePointPublic } from "@/client"
import { cn } from "@/lib/utils"

import { formatCents, formatShortDate } from "./format"

export interface PriceHistoryChartProps {
  /** Observed prices, any order. The first is what the item was added at. */
  points: PricePointPublic[]
  /** The item's current price - extends the line to "today". */
  currentPriceCents: number
  /** Plot height in px (the container decides the width). */
  height?: number
  className?: string
}

interface PlotPoint {
  x: number
  y: number
  time: number
  priceCents: number
  /** True for the synthetic "now" point that extends the last price. */
  isNow: boolean
}

// Room above the line for the two end labels, below it for the dates.
const MARGIN = { top: 34, right: 12, bottom: 20, left: 12 }
const MIN_SPAN_MS = 24 * 60 * 60 * 1000 // never squash a brand-new history
// Rough width of a price label, used to drop the start label when the two
// would collide on a narrow plot.
const LABEL_WIDTH_PX = 60

/**
 * Step line of an item's price over time.
 *
 * Prices only change at observation moments, so the line holds each value
 * until the next reading (step-after) and runs to "today" at the current
 * price. The first and last prices are labelled directly - that is the
 * "was X, now Y" story - and everything in between is read by touching the
 * line, which snaps a crosshair to the nearest reading.
 */
export function PriceHistoryChart({
  points,
  currentPriceCents,
  height = 150,
  className,
}: PriceHistoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width = 320 } = useResizeObserver({
    ref: containerRef as React.RefObject<HTMLElement>,
    box: "border-box",
  })
  const gradientId = useId()
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const model = useMemo(() => {
    const sorted = [...points]
      .map((p) => ({
        time: new Date(p.recorded_at).getTime(),
        price: p.price_cents,
      }))
      .filter((p) => Number.isFinite(p.time))
      .sort((a, b) => a.time - b.time)

    const now = Date.now()
    const start = sorted[0]?.time ?? now
    const end = Math.max(now, start + MIN_SPAN_MS)

    const prices = [...sorted.map((p) => p.price), currentPriceCents]
    let minPrice = Math.min(...prices)
    let maxPrice = Math.max(...prices)
    if (maxPrice === minPrice) {
      // Flat line: give it some air so it doesn't sit on an edge.
      const pad = Math.max(100, Math.round(minPrice * 0.06))
      minPrice -= pad
      maxPrice += pad
    } else {
      const pad = (maxPrice - minPrice) * 0.18
      minPrice -= pad
      maxPrice += pad
    }
    minPrice = Math.max(0, minPrice)

    const innerWidth = Math.max(1, width - MARGIN.left - MARGIN.right)
    const innerHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom)
    const xFor = (t: number) =>
      MARGIN.left + ((t - start) / (end - start)) * innerWidth
    const yFor = (c: number) =>
      MARGIN.top +
      innerHeight -
      ((c - minPrice) / (maxPrice - minPrice)) * innerHeight

    const plot: PlotPoint[] = sorted.map((p) => ({
      x: xFor(p.time),
      y: yFor(p.price),
      time: p.time,
      priceCents: p.price,
      isNow: false,
    }))
    plot.push({
      x: xFor(end),
      y: yFor(currentPriceCents),
      time: now,
      priceCents: currentPriceCents,
      isNow: true,
    })

    // Step-after path: hold each price until the next reading.
    let line = ""
    for (let i = 0; i < plot.length; i++) {
      const p = plot[i]
      if (i === 0) {
        line += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      } else {
        line += ` H ${p.x.toFixed(1)} V ${p.y.toFixed(1)}`
      }
    }
    const baseline = MARGIN.top + innerHeight
    const first = plot[0]
    const last = plot[plot.length - 1]
    const area = `${line} V ${baseline.toFixed(1)} H ${first.x.toFixed(1)} Z`

    return { plot, line, area, baseline, first, last }
  }, [points, currentPriceCents, width, height])

  const { plot, line, area, baseline, first, last } = model

  const nearestIndex = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return null
      const x = clientX - rect.left
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      plot.forEach((p, i) => {
        const d = Math.abs(p.x - x)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      return best
    },
    [plot],
  )

  const handlePointer = (event: React.PointerEvent) => {
    const index = nearestIndex(event.clientX)
    if (index !== null) setActiveIndex(index)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault()
      const delta = event.key === "ArrowRight" ? 1 : -1
      setActiveIndex((current) => {
        const base = current ?? plot.length - 1
        return Math.min(plot.length - 1, Math.max(0, base + delta))
      })
    } else if (event.key === "Escape") {
      setActiveIndex(null)
    }
  }

  const active = activeIndex !== null ? plot[activeIndex] : null
  const showEndLabel = !active || activeIndex === plot.length - 1
  // The starting price only earns its label when it says something new and
  // there is room for it.
  const showStartLabel =
    plot.length > 1 &&
    first.priceCents !== currentPriceCents &&
    last.x - first.x > LABEL_WIDTH_PX * 2

  // Keep the tooltip inside the plot horizontally.
  const tooltipLeft = active
    ? Math.min(Math.max(active.x, MARGIN.left + 40), width - 52)
    : 0

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full select-none", className)}
      style={{ height }}
    >
      <svg
        role="img"
        aria-label={`Price history: ${formatCents(first.priceCents)} when added, ${formatCents(currentPriceCents)} now. Use arrow keys to step through readings.`}
        width={width}
        height={height}
        className="block touch-none overflow-visible focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 rounded-md"
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActiveIndex(null)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={handleKeyDown}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area wash + step line, drawn in the foreground ink */}
        <g className="text-foreground">
          <path d={area} fill={`url(#${gradientId})`} />
          <motion.path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </g>

        {/* X labels: when it was added, and today */}
        <text
          x={first.x}
          y={height - 4}
          textAnchor="start"
          className="fill-muted-foreground text-[10px]"
        >
          {formatShortDate(first.time)}
        </text>
        <text
          x={last.x}
          y={height - 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          Today
        </text>

        {/* Where the price started */}
        {showStartLabel && (
          <g className="text-muted-foreground">
            <circle
              cx={first.x}
              cy={first.y}
              r={3}
              fill="currentColor"
              opacity={0.6}
            />
            <text
              x={first.x}
              y={first.y - 10}
              textAnchor="start"
              className="fill-muted-foreground font-display text-xs font-light tabular-nums"
            >
              {formatCents(first.priceCents)}
            </text>
          </g>
        )}

        {/* End marker with surface ring + direct label for the current price */}
        <g className="text-foreground">
          <circle cx={last.x} cy={last.y} r={5.5} className="fill-background" />
          <circle cx={last.x} cy={last.y} r={4} fill="currentColor" />
          {showEndLabel && (
            <text
              x={last.x}
              y={last.y - 10}
              textAnchor="end"
              className="fill-foreground font-display text-sm font-light tabular-nums"
            >
              {formatCents(currentPriceCents)}
            </text>
          )}
        </g>

        {/* Crosshair */}
        {active && (
          <g className="text-foreground">
            <line
              x1={active.x}
              x2={active.x}
              y1={MARGIN.top - 4}
              y2={baseline}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            <circle
              cx={active.x}
              cy={active.y}
              r={6}
              className="fill-background"
            />
            <circle cx={active.x} cy={active.y} r={4} fill="currentColor" />
          </g>
        )}
      </svg>

      {/* Tooltip (HTML so it can carry two lines of real text) */}
      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border/60 bg-popover px-2 py-1 text-center shadow-sm"
          style={{ left: tooltipLeft }}
        >
          <p className="font-display text-sm font-light tabular-nums text-foreground">
            {formatCents(active.priceCents)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {active.isNow ? "Today" : formatShortDate(active.time)}
          </p>
        </div>
      )}
    </div>
  )
}
