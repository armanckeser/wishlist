import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface ActionGroupProps {
  children: ReactNode
  className?: string
}

/**
 * Layout wrapper for action buttons.
 * Provides consistent spacing and flex layout.
 */
export function ActionGroup({ children, className }: ActionGroupProps) {
  return <div className={cn("flex gap-3", className)}>{children}</div>
}
