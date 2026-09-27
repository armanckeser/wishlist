import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

import {
  type FilterDimensionId,
  type RangeFilter,
  type ThreeStateFilter,
  useFilter,
} from "../filtering"
import {
  computeNextThreeState,
  getThreeState,
  PageHeader,
  SelectRow,
  ThreeStateRow,
} from "./shared"

interface FilterDimensionPageProps {
  dimensionId: FilterDimensionId
  onBack: () => void
  onDone: () => void
}

export function FilterDimensionPage({
  dimensionId,
  onBack,
  onDone,
}: FilterDimensionPageProps) {
  const { viewState, updateFilter, registry, dimensionOptions } = useFilter()

  const dimension = registry[dimensionId]
  const options = dimensionOptions[dimensionId]

  const handleThreeStateToggle = (toggleValue: string) => {
    const current = viewState.filters[dimensionId] as ThreeStateFilter
    const updated = computeNextThreeState(current, toggleValue)
    updateFilter(dimensionId, updated)
  }

  const handleClearFilter = () => {
    if (dimension.type === "three-state") {
      updateFilter(dimensionId, { mode: "any" })
    } else if (dimension.type === "range") {
      updateFilter(dimensionId, {})
    }
  }

  // Three-state filter UI
  if (dimension.type === "three-state") {
    const filter = viewState.filters[dimensionId] as ThreeStateFilter

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={dimension.label} onBack={onBack} onDone={onDone} />
        <div className="px-4 pb-2 text-xs text-muted-foreground">
          Tap: include → exclude → clear
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <SelectRow
            label="Any"
            selected={filter.mode === "any"}
            onClick={handleClearFilter}
          />
          <Separator className="my-2" />
          <div className="space-y-1">
            {options.map((option) => (
              <ThreeStateRow
                key={option.value}
                option={option}
                state={getThreeState(filter, option.value)}
                onClick={() => handleThreeStateToggle(option.value)}
                renderOption={dimension.renderOption}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Range filter UI
  if (dimension.type === "range") {
    const priceFilter = viewState.filters[dimensionId] as RangeFilter
    const hasFilter =
      priceFilter.min !== undefined || priceFilter.max !== undefined

    const handleMinChange = (value: string) => {
      const num = value === "" ? undefined : Number(value)
      updateFilter(dimensionId, { ...priceFilter, min: num })
    }

    const handleMaxChange = (value: string) => {
      const num = value === "" ? undefined : Number(value)
      updateFilter(dimensionId, { ...priceFilter, max: num })
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={dimension.label} onBack={onBack} onDone={onDone} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <SelectRow
            label="Any"
            selected={!hasFilter}
            onClick={handleClearFilter}
          />
          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price-min" className="text-sm">
                Minimum ($)
              </Label>
              <Input
                id="price-min"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="No minimum"
                value={priceFilter.min ?? ""}
                onChange={(e) => handleMinChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-max" className="text-sm">
                Maximum ($)
              </Label>
              <Input
                id="price-max"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                placeholder="No maximum"
                value={priceFilter.max ?? ""}
                onChange={(e) => handleMaxChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
