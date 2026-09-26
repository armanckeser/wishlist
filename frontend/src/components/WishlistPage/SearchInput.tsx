import { Search, X } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Search input with clear button for the wishlist toolbar.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClear = () => {
    onChange("")
    inputRef.current?.focus()
  }

  return (
    <search className="relative flex-1">
      <form onSubmit={(e) => e.preventDefault()}>
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 pl-8 text-base"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-transparent"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </form>
    </search>
  )
}
