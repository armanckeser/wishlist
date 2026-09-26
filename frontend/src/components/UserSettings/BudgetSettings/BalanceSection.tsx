import { BudgetTicker } from "@/components/Budget"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { cn } from "@/lib/utils"

import type { AdjustMode } from "./types"

interface BalanceSectionProps {
  adjustMode: AdjustMode
  onAdjustModeChange: (mode: AdjustMode) => void
  adjustAmount: string
  onAdjustAmountChange: (value: string) => void
  setExactAmount: string
  onSetExactAmountChange: (value: string) => void
  onAdjustBalance: (delta: number) => void
  onSetExactBalance: () => void
  isPending: boolean
}

export function BalanceSection({
  adjustMode,
  onAdjustModeChange,
  adjustAmount,
  onAdjustAmountChange,
  setExactAmount,
  onSetExactAmountChange,
  onAdjustBalance,
  onSetExactBalance,
  isPending,
}: BalanceSectionProps) {
  const handleSubtract = () => {
    const val = Number.parseFloat(adjustAmount)
    if (!Number.isNaN(val) && val > 0) {
      onAdjustBalance(-val)
    }
  }

  const handleAdd = () => {
    const val = Number.parseFloat(adjustAmount)
    if (!Number.isNaN(val) && val > 0) {
      onAdjustBalance(val)
    }
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h4 className="text-sm font-medium">Current balance</h4>
        <div className="mt-2">
          <BudgetTicker size="sm" />
        </div>
      </div>

      {/* Adjustment Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAdjustModeChange("adjust")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            adjustMode === "adjust"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          Adjust by
        </button>
        <button
          type="button"
          onClick={() => onAdjustModeChange("set")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            adjustMode === "set"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          Set exact
        </button>
      </div>

      {/* Adjust by - Stepper UI */}
      {adjustMode === "adjust" && (
        <div className="flex items-center gap-2">
          <LoadingButton
            type="button"
            variant="outline"
            onClick={handleSubtract}
            loading={isPending}
            disabled={!adjustAmount}
            className="shrink-0"
          >
            Subtract
          </LoadingButton>

          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="0.00"
              value={adjustAmount}
              onChange={(e) => onAdjustAmountChange(e.target.value)}
              className="pl-7 text-center"
            />
          </div>

          <LoadingButton
            type="button"
            onClick={handleAdd}
            loading={isPending}
            disabled={!adjustAmount}
            className="shrink-0"
          >
            Add
          </LoadingButton>
        </div>
      )}

      {/* Set exact */}
      {adjustMode === "set" && (
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="Enter exact amount"
              value={setExactAmount}
              onChange={(e) => onSetExactAmountChange(e.target.value)}
              className="pl-7"
            />
          </div>

          <LoadingButton
            type="button"
            onClick={onSetExactBalance}
            loading={isPending}
            disabled={!setExactAmount}
          >
            Set balance
          </LoadingButton>
        </div>
      )}
    </div>
  )
}
