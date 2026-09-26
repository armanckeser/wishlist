import type { FilterDimensionId } from "../filtering"

/** Navigation pages within the filter sheet */
export type SheetPage = "main" | FilterDimensionId | "sort" | "group"

export interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Common props for sub-pages with back navigation */
export interface SubPageProps {
  onBack: () => void
  onDone: () => void
}
