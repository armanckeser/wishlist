"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

import type { TrackingEventPublic } from "@/client"
import { cn } from "@/lib/utils"

import { TrackingEvents } from "./TrackingEvents"

export type DeliveryStage =
  | "label_created"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"

export interface DeliveryProgressProps {
  /** Current delivery stage */
  stage: DeliveryStage
  /** Estimated delivery date */
  estimatedDelivery?: Date
  /** Additional CSS classes */
  className?: string
  /** Tracking events for expandable view */
  events?: TrackingEventPublic[]
  /** Whether to show expand toggle for events */
  expandable?: boolean
}

const STAGE_ORDER: DeliveryStage[] = [
  "label_created",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
]

const STAGE_LABELS: Record<DeliveryStage, string> = {
  label_created: "Label Created",
  shipped: "Shipped",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
}

function formatDeliveryDate(date: Date): string {
  const now = new Date()

  // Compare calendar dates, not time differences
  // Set hours to 0 to compare just the date part
  const deliveryDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffDays = Math.round(
    (deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (diffDays === 0) {
    // Show time for today's deliveries
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: date.getMinutes() === 0 ? undefined : "2-digit",
      hour12: true,
    })
    return `Today ~${timeStr}`
  }

  if (diffDays === 1) return "Tomorrow"

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/**
 * Option B: Milestone dots with gradient connecting line
 *
 * Shows key shipping stages as dots on a gradient line.
 * Filled dots for completed stages, hollow for pending.
 * Time displayed inline to the right.
 * Optionally expandable to show tracking events.
 */
export function DeliveryProgressMilestones({
  stage,
  estimatedDelivery,
  className,
  events = [],
  expandable = false,
}: DeliveryProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const currentIndex = STAGE_ORDER.indexOf(stage)
  const isException = stage === "exception"
  const isDelivered = stage === "delivered"

  // Simplified stages for display
  const displayStages: DeliveryStage[] = [
    "label_created",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
  ]

  // Blue→teal gradient for shipping (matches Option A)
  const progressGradient = isDelivered
    ? "oklch(0.7 0.15 170)" // Teal for delivered
    : isException
      ? "oklch(0.6 0.2 25)" // Red for exception
      : `linear-gradient(90deg,
          oklch(0.5 0.12 240) 0%,
          oklch(0.6 0.14 220) 40%,
          oklch(0.7 0.15 200) 70%,
          oklch(0.75 0.14 180) 100%)`

  // Dot color based on progress position
  const getDotColor = (index: number) => {
    if (isException && currentIndex === index) return "oklch(0.6 0.2 25)"
    if (isDelivered) return "oklch(0.7 0.15 170)"
    // Interpolate along the gradient based on position
    const colors = [
      "oklch(0.5 0.12 240)",
      "oklch(0.55 0.13 230)",
      "oklch(0.6 0.14 220)",
      "oklch(0.68 0.145 190)",
      "oklch(0.75 0.14 180)",
    ]
    return colors[Math.min(index, colors.length - 1)]
  }

  const handleExpandToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsExpanded(!isExpanded)
  }

  const handleExpandKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      handleExpandToggle(e)
    }
  }

  const hasEvents = events.length > 0
  const showExpandToggle = expandable && hasEvents

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3">
        {/* Progress with dots */}
        <div className="relative flex flex-1 items-center justify-between">
          {/* Connecting line background */}
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-muted" />

          {/* Progress gradient line */}
          <div
            className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 transition-all duration-500"
            style={{
              width: `${Math.max(0, (currentIndex / (displayStages.length - 1)) * 100)}%`,
              background: progressGradient,
            }}
          />

          {/* Milestone dots */}
          {displayStages.map((s, index) => {
            const isCompleted = currentIndex >= index
            const isCurrent = currentIndex === index

            return (
              <div
                key={s}
                className={cn(
                  "relative z-10 h-2.5 w-2.5 rounded-full border-2 transition-all duration-300",
                  isCompleted
                    ? "border-transparent"
                    : "border-muted-foreground/30 bg-background",
                  isCurrent &&
                    !isException &&
                    "ring-2 ring-offset-1 ring-offset-background",
                )}
                style={
                  {
                    background: isCompleted ? getDotColor(index) : undefined,
                    // Ring color matches dot color
                    "--tw-ring-color": isCurrent
                      ? getDotColor(index)
                      : undefined,
                  } as React.CSSProperties
                }
              />
            )
          })}
        </div>

        {/* Time/status inline to the right */}
        <span className="shrink-0 text-xs text-muted-foreground">
          {isDelivered
            ? "Delivered"
            : estimatedDelivery
              ? formatDeliveryDate(estimatedDelivery)
              : STAGE_LABELS[stage]}
        </span>

        {/* Expand toggle */}
        {showExpandToggle && (
          <button
            type="button"
            onClick={handleExpandToggle}
            onKeyDown={handleExpandKeyDown}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none bg-transparent border-none p-0"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Hide tracking updates" : "Show tracking updates"
            }
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded events */}
      {isExpanded && hasEvents && (
        <div className="pt-1">
          <TrackingEvents events={events} maxVisibleEvents={3} />
        </div>
      )}
    </div>
  )
}

/**
 * DeliveryProgress component
 *
 * Shows key shipping stages as dots on a gradient line.
 * Filled dots for completed stages, hollow for pending.
 * Time displayed inline to the right.
 * Optionally expandable to show tracking events.
 */
export const DeliveryProgress = DeliveryProgressMilestones

export default DeliveryProgress
