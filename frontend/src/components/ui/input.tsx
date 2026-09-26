import * as React from "react"

import { cn } from "@/lib/utils"

const INPUT_MODE_BY_TYPE: Record<
  string,
  React.HTMLAttributes<HTMLInputElement>["inputMode"]
> = {
  email: "email",
  tel: "tel",
  url: "url",
  search: "search",
  number: "decimal",
}

const ENTER_KEY_HINT_BY_TYPE: Record<
  string,
  React.HTMLAttributes<HTMLInputElement>["enterKeyHint"]
> = {
  email: "next",
  url: "next",
  tel: "next",
  search: "search",
  password: "go",
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, enterKeyHint, ...props }, ref) => {
    const resolvedInputMode =
      inputMode ?? (type ? INPUT_MODE_BY_TYPE[type] : undefined)
    const resolvedEnterKeyHint =
      enterKeyHint ?? (type ? ENTER_KEY_HINT_BY_TYPE[type] : undefined)

    return (
      <input
        ref={ref}
        type={type}
        inputMode={resolvedInputMode}
        enterKeyHint={resolvedEnterKeyHint}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
