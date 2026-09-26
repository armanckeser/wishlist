import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"

import {
  type FilterDimensionId,
  GROUP_BY_OPTIONS,
  type RangeFilter,
  type ThreeStateFilter,
  useFilter,
} from "../filtering"
import { MenuRow } from "./shared"
import type { SheetPage } from "./types"

interface MainPageProps {
  onNavigate: (page: SheetPage) => void
  onReset: () => void
  onDone: () => void
  hasFilters: boolean
}

export function MainPage({
  onNavigate,
  onReset,
  onDone,
  hasFilters,
}: MainPageProps) {
  const { viewState, sortDefinitions, registry, dimensionOptions } = useFilter()

  const getSortLabel = () => {
    const sortDef = sortDefinitions.find((s) => s.value === viewState.sort)
    return sortDef?.label ?? "Default"
  }

  const getGroupLabel = () => {
    const option = GROUP_BY_OPTIONS.find((o) => o.value === viewState.groupBy)
    return option?.label ?? "Maturity"
  }

  const getFilterSummary = (dimensionId: FilterDimensionId): string => {
    const dim = registry[dimensionId]
    const filter = viewState.filters[dimensionId]

    if (dim.type === "range") {
      const range = filter as RangeFilter
      if (range.min !== undefined || range.max !== undefined) {
        if (range.min !== undefined && range.max !== undefined) {
          return `$${range.min} - $${range.max}`
        }
        if (range.min !== undefined) return `$${range.min}+`
        if (range.max !== undefined) return `Up to $${range.max}`
      }
      return "Any"
    }

    const threeState = filter as ThreeStateFilter
    if (threeState.mode === "any") return "Any"

    // Look up label from options for single value
    const getLabel = (value: string) => {
      const options = dimensionOptions[dimensionId]
      const option = options?.find((o) => o.value === value)
      return option?.label ?? value
    }

    if (threeState.mode === "include") {
      return threeState.values.length === 1
        ? getLabel(threeState.values[0])
        : `${threeState.values.length} selected`
    }
    return `Excluding ${threeState.values.length}`
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader className="grid grid-cols-3 items-center">
        <div /> {/* Empty spacer for grid alignment */}
        <DrawerTitle className="text-center text-lg font-semibold">
          Filters
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

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* Sort & Group */}
        <div className="space-y-1">
          <MenuRow
            label="Sort By"
            value={getSortLabel()}
            onClick={() => onNavigate("sort")}
          />
          <MenuRow
            label="Group By"
            value={getGroupLabel()}
            onClick={() => onNavigate("group")}
          />
        </div>

        <Separator className="my-4" />

        {/* Filters - derived from registry */}
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Filters
        </div>
        <div className="space-y-1">
          {(Object.keys(registry) as FilterDimensionId[]).map((id) => (
            <MenuRow
              key={id}
              label={registry[id].label}
              value={getFilterSummary(id)}
              onClick={() => onNavigate(id)}
            />
          ))}
        </div>

        <Separator className="my-4" />

        {/* Reset */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onReset}
          disabled={!hasFilters}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  )
}
