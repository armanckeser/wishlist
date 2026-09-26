import { type RefObject, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { MilestoneEffects, type MilestoneLevel } from "./MilestoneEffects"

interface AnimationPortalProps {
  level: MilestoneLevel | null
  trigger: number
  anchorRef: RefObject<HTMLElement | null>
}

/**
 * Renders milestone effects in a portal at the document body level.
 * Positions the effects based on the anchor element's position.
 * This prevents parent containers from clipping the animations.
 */
export function AnimationPortal({
  level,
  trigger,
  anchorRef,
}: AnimationPortalProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  )

  // Update position when trigger changes or on mount
  useEffect(() => {
    if (!anchorRef.current) return

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      }
    }

    updatePosition()

    // Keep position updated during scroll/resize
    window.addEventListener("scroll", updatePosition, { passive: true })
    window.addEventListener("resize", updatePosition, { passive: true })

    return () => {
      window.removeEventListener("scroll", updatePosition)
      window.removeEventListener("resize", updatePosition)
    }
  }, [anchorRef])

  if (!position || !level || trigger === 0) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={
        {
          // The container spans the full viewport
          // Effects will be positioned from the anchor point
        }
      }
    >
      <div
        className="absolute"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -50%)",
        }}
      >
        <MilestoneEffects level={level} trigger={trigger} />
      </div>
    </div>,
    document.body,
  )
}
