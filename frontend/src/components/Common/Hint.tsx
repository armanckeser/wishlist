import { Info } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface HintProps {
  /** The explanation. One sentence - if it needs two, the UI needs fixing. */
  children: React.ReactNode
  /** Accessible name for the trigger. */
  label?: string
  className?: string
  /** Custom trigger. Defaults to a small info dot. */
  trigger?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

/**
 * Where the long version of a label lives.
 *
 * The interface says things in a word or two; anything that needs a sentence
 * goes in here. Built on a popover rather than a hover tooltip because this
 * app is used on a phone, where there is no hover to reveal anything.
 */
export function Hint({
  children,
  label = "More info",
  className,
  trigger,
  side = "top",
  align = "start",
}: HintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 items-center text-muted-foreground/60",
              "transition-colors hover:text-foreground focus-visible:text-foreground",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 rounded-full",
              className,
            )}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-60 p-3 text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
