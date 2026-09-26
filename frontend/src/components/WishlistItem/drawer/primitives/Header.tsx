import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface HeaderProps {
  children: ReactNode
  className?: string
}

/**
 * Header container for drawer.
 * Typically contains Menu and CloseButton.
 */
export function Header({ children, className }: HeaderProps) {
  return (
    <div className={cn("flex items-center justify-end px-4 pb-2", className)}>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}
