import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface FooterProps {
  children: ReactNode
  className?: string
}

/**
 * Footer container for drawer actions.
 */
export function Footer({ children, className }: FooterProps) {
  return <div className={cn("mt-8 space-y-4", className)}>{children}</div>
}
