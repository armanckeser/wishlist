import { type SortOption, useFilter } from "../filtering"
import { PageHeader, SelectRow } from "./shared"
import type { SubPageProps } from "./types"

export function SortPage({ onBack, onDone }: SubPageProps) {
  const { viewState, updateViewState, sortDefinitions } = useFilter()

  const handleChange = (value: SortOption) => {
    updateViewState({ ...viewState, sort: value })
  }

  // Group by category
  const categories = sortDefinitions.reduce(
    (acc, def) => {
      if (!acc[def.category]) acc[def.category] = []
      acc[def.category].push(def)
      return acc
    },
    {} as Record<string, typeof sortDefinitions>,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Sort By" onBack={onBack} onDone={onDone} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {Object.entries(categories).map(([category, options]) => (
          <div key={category} className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {category}
            </div>
            <div className="space-y-1">
              {options.map((option) => (
                <SelectRow
                  key={option.value}
                  label={option.label}
                  selected={viewState.sort === option.value}
                  onClick={() => handleChange(option.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
