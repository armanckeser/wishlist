import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

interface BudgetVisibilityContextValue {
  /** Whether the main budget display is visible in the viewport */
  isBudgetVisible: boolean
  /** Set the budget visibility state (called by the page component) */
  setIsBudgetVisible: (visible: boolean) => void
}

const BudgetVisibilityContext = createContext<
  BudgetVisibilityContextValue | undefined
>(undefined)

export function BudgetVisibilityProvider({
  children,
}: {
  children: ReactNode
}) {
  const [isBudgetVisible, setIsBudgetVisibleState] = useState(true)

  const setIsBudgetVisible = useCallback((visible: boolean) => {
    setIsBudgetVisibleState(visible)
  }, [])

  const value = useMemo(
    () => ({ isBudgetVisible, setIsBudgetVisible }),
    [isBudgetVisible, setIsBudgetVisible],
  )

  return (
    <BudgetVisibilityContext.Provider value={value}>
      {children}
    </BudgetVisibilityContext.Provider>
  )
}

export function useBudgetVisibility(): BudgetVisibilityContextValue {
  const context = useContext(BudgetVisibilityContext)
  if (!context) {
    throw new Error(
      "useBudgetVisibility must be used within a BudgetVisibilityProvider",
    )
  }
  return context
}
