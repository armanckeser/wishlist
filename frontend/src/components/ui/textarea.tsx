import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Auto-sizing textarea using `field-sizing: content` (Baseline newly available
 * in Chrome 123+, Safari 17.4+). Falls back to standard fixed-height behavior
 * in unsupported browsers — no JS measurement hack needed.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "border-input bg-transparent dark:bg-input/30 placeholder:text-muted-foreground",
        "w-full min-w-0 rounded-md border px-3 py-2 text-base shadow-xs",
        "outline-none transition-[color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // field-sizing autosizes vertically up to ~6 lines, then scrolls.
        // height: auto resets any global rule that might fix height.
        "[field-sizing:content] [height:auto] min-h-[3lh] max-h-[6lh]",
        className,
      )}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
