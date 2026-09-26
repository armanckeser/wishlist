import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface BodyProps {
  children: ReactNode
  className?: string
}

/**
 * Scrollable body container for drawer content.
 */
export function Body({ children, className }: BodyProps) {
  return (
    <div className={cn("overflow-y-auto px-6 pb-8", className)}>{children}</div>
  )
}
