/**
 * Context for budget info.
 * Provides budget data without prop drilling through component layers.
 */

import { createContext, type ReactNode, useContext } from "react"

import { type BudgetInfo, useBudget } from "@/hooks/useBudget"

// =============================================================================
// Context Type
// =============================================================================

interface BudgetInfoContextValue {
  /** Budget info, or null if not yet loaded */
  budgetInfo: BudgetInfo | null
}

const BudgetInfoContext = createContext<BudgetInfoContextValue | undefined>(
  undefined,
)

// =============================================================================
// Provider
// =============================================================================

interface BudgetInfoProviderProps {
  children: ReactNode
  /** Optional mock budget info for Storybook (bypasses useBudget hook result) */
  mockBudgetInfo?: BudgetInfo | null
}

export function BudgetInfoProvider({
  children,
  mockBudgetInfo,
}: BudgetInfoProviderProps) {
  const realBudgetInfo = useBudget()
  // Use mock if explicitly provided (even if null), otherwise use real
  const budgetInfo =
    mockBudgetInfo !== undefined ? mockBudgetInfo : realBudgetInfo

  return (
    <BudgetInfoContext.Provider value={{ budgetInfo }}>
      {children}
    </BudgetInfoContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access budget info.
 * Must be used within BudgetInfoProvider.
 */
export function useBudgetInfo(): BudgetInfo | null {
  const context = useContext(BudgetInfoContext)
  if (!context) {
    throw new Error("useBudgetInfo must be used within a BudgetInfoProvider")
  }
  return context.budgetInfo
}
