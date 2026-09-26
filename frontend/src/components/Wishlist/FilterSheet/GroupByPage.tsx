import {
  type FilterDimensionId,
  GROUP_BY_OPTIONS,
  useFilter,
} from "../filtering"
import { PageHeader, SelectRow } from "./shared"
import type { SubPageProps } from "./types"

export function GroupByPage({ onBack, onDone }: SubPageProps) {
  const { viewState, updateViewState } = useFilter()

  const handleChange = (value: string) => {
    updateViewState({
      ...viewState,
      groupBy: value as FilterDimensionId | "none",
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Group By" onBack={onBack} onDone={onDone} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-1">
          {GROUP_BY_OPTIONS.map((option) => (
            <SelectRow
              key={option.value}
              label={option.label}
              selected={viewState.groupBy === option.value}
              onClick={() => handleChange(option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
