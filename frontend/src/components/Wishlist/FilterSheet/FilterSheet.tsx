/**
 * Filter Sheet - Bottom sheet for filtering, sorting, and grouping.
 *
 * This component reads everything from FilterContext.
 * No props needed except open/onOpenChange for the drawer.
 */

import { useState } from "react"

import { Drawer, DrawerContent } from "@/components/ui/drawer"

import { hasActiveFilters, useFilter } from "../filtering"
import { FilterDimensionPage } from "./FilterDimensionPage"
import { GroupByPage } from "./GroupByPage"
import { MainPage } from "./MainPage"
import { SortPage } from "./SortPage"
import type { FilterSheetProps, SheetPage } from "./types"

export function FilterSheet({ open, onOpenChange }: FilterSheetProps) {
  const [page, setPage] = useState<SheetPage>("main")
  const { resetFilters, viewState } = useFilter()

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPage("main")
    }
    onOpenChange(newOpen)
  }

  const handleReset = () => {
    resetFilters()
  }

  const handleDone = () => {
    handleOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        {page === "main" ? (
          <MainPage
            onNavigate={setPage}
            onReset={handleReset}
            onDone={handleDone}
            hasFilters={hasActiveFilters(viewState)}
          />
        ) : page === "sort" ? (
          <SortPage onBack={() => setPage("main")} onDone={handleDone} />
        ) : page === "group" ? (
          <GroupByPage onBack={() => setPage("main")} onDone={handleDone} />
        ) : (
          <FilterDimensionPage
            dimensionId={page}
            onBack={() => setPage("main")}
            onDone={handleDone}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}
