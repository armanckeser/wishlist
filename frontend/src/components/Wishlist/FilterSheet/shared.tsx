import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

import type { FilterOption, ThreeStateFilter } from "../filtering"

// =============================================================================
// PAGE HEADER
// =============================================================================

interface PageHeaderProps {
  title: string
  onBack: () => void
  onDone: () => void
}

export function PageHeader({ title, onBack, onDone }: PageHeaderProps) {
  return (
    <DrawerHeader className="grid grid-cols-3 items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2 justify-self-start"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back
      </Button>
      <DrawerTitle className="text-center text-lg font-semibold">
        {title}
      </DrawerTitle>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDone}
        className="justify-self-end"
      >
        Done
      </Button>
    </DrawerHeader>
  )
}

// =============================================================================
// MENU ROW (for main page navigation)
// =============================================================================

interface MenuRowProps {
  label: string
  value: string
  onClick: () => void
}

export function MenuRow({ label, value, onClick }: MenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  )
}

// =============================================================================
// SELECT ROW (for single-select options)
// =============================================================================

interface SelectRowProps {
  label: string
  selected: boolean
  onClick: () => void
}

export function SelectRow({ label, selected, onClick }: SelectRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className={cn("text-sm", selected && "font-medium")}>{label}</span>
      {selected && <span className="text-primary">✓</span>}
    </button>
  )
}

// =============================================================================
// THREE-STATE FILTER
// =============================================================================

export type ThreeState = "neutral" | "include" | "exclude"

export function getThreeState(
  filter: ThreeStateFilter,
  value: string,
): ThreeState {
  if (filter.mode === "any") return "neutral"
  if (filter.mode === "include" && filter.values.includes(value))
    return "include"
  if (filter.mode === "exclude" && filter.values.includes(value))
    return "exclude"
  return "neutral"
}

/**
 * Compute next three-state filter when toggling a value.
 * Cycle: neutral → include → exclude → neutral
 */
export function computeNextThreeState(
  current: ThreeStateFilter,
  toggleValue: string,
): ThreeStateFilter {
  if (current.mode === "any") {
    return { mode: "include", values: [toggleValue] }
  }

  if (current.mode === "include") {
    if (current.values.includes(toggleValue)) {
      const remaining = current.values.filter((v) => v !== toggleValue)
      if (remaining.length === 0) {
        return { mode: "exclude", values: [toggleValue] }
      }
      return { mode: "exclude", values: [toggleValue] }
    }
    return { mode: "include", values: [...current.values, toggleValue] }
  }

  if (current.mode === "exclude") {
    if (current.values.includes(toggleValue)) {
      const remaining = current.values.filter((v) => v !== toggleValue)
      if (remaining.length === 0) {
        return { mode: "any" }
      }
      return { mode: "exclude", values: remaining }
    }
    return { mode: "exclude", values: [...current.values, toggleValue] }
  }

  return current
}

interface ThreeStateRowProps {
  option: FilterOption
  state: ThreeState
  onClick: () => void
  renderOption?: (option: FilterOption) => React.ReactNode
}

export function ThreeStateRow({
  option,
  state,
  onClick,
  renderOption,
}: ThreeStateRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className={cn("text-sm", state !== "neutral" && "font-medium")}>
        {renderOption ? renderOption(option) : option.label}
      </span>
      {state === "include" && <Check className="h-4 w-4 text-foreground" />}
      {state === "exclude" && <X className="h-4 w-4 text-foreground" />}
    </button>
  )
}
