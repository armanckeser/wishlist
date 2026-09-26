/**
 * Budget Settings - Coordinator component for all budget-related settings.
 *
 * Manages:
 * - Monthly rate configuration
 * - Balance adjustments (add/subtract/set exact)
 * - Freeze status and unfreeze action
 * - Cool-off period settings
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { BudgetService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import {
  calculateCurrentCents,
  centsToDollars,
  dollarsToCents,
} from "@/lib/budget"
import { handleError } from "@/utils"

import { BalanceSection } from "./BalanceSection"
import { CooloffSection } from "./CooloffSection"
import { FreezeSection } from "./FreezeSection"
import { MonthlyRateSection } from "./MonthlyRateSection"
import {
  type AdjustMode,
  type CooloffFormData,
  cooloffFormSchema,
  type RateFormData,
  rateFormSchema,
} from "./types"

function BudgetSettings() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  // Adjustment state
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("adjust")
  const [adjustAmount, setAdjustAmount] = useState("")
  const [setExactAmount, setSetExactAmount] = useState("")

  const { data: budget, isLoading } = useQuery({
    queryKey: ["budget"],
    queryFn: () => BudgetService.getBudget(),
  })

  const rateForm = useForm<RateFormData>({
    resolver: zodResolver(rateFormSchema),
    mode: "onBlur",
    defaultValues: {
      monthlyRateDollars: "600",
    },
  })

  const cooloffForm = useForm<CooloffFormData>({
    resolver: zodResolver(cooloffFormSchema),
    mode: "onBlur",
    defaultValues: {
      scalingDollars: "",
      scalingDays: "3",
      thresholdDollars: "",
      thresholdDays: "7",
      maxDays: "",
      freezePenaltyDays: "7",
    },
  })

  // Update forms when budget data loads
  useEffect(() => {
    if (budget) {
      rateForm.reset({
        monthlyRateDollars: String(
          centsToDollars(budget.monthly_rate_cents ?? 60000),
        ),
      })
      cooloffForm.reset({
        scalingDollars: budget.cooloff_scaling_cents
          ? String(centsToDollars(budget.cooloff_scaling_cents))
          : "",
        scalingDays: String(budget.cooloff_scaling_days ?? 3),
        thresholdDollars: budget.cooloff_min_threshold_cents
          ? String(centsToDollars(budget.cooloff_min_threshold_cents))
          : "",
        thresholdDays: String(budget.cooloff_min_threshold_days ?? 7),
        maxDays: budget.cooloff_max_days ? String(budget.cooloff_max_days) : "",
        freezePenaltyDays: String(budget.freeze_penalty_days ?? 7),
      })
    }
  }, [budget, rateForm, cooloffForm])

  // Check if budget is frozen
  const isFrozen = budget?.stashed_monthly_rate_cents != null

  const updateBudgetMutation = useMutation({
    mutationFn: (data: {
      cents_at_last_update?: number
      monthly_rate_cents?: number
      cooloff_scaling_cents?: number | null
      cooloff_scaling_days?: number
      cooloff_min_threshold_cents?: number | null
      cooloff_min_threshold_days?: number
      cooloff_max_days?: number | null
      freeze_penalty_days?: number
    }) => BudgetService.updateBudget({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Budget updated")
      queryClient.invalidateQueries({ queryKey: ["budget"] })
      setAdjustAmount("")
      setSetExactAmount("")
    },
    onError: handleError.bind(showErrorToast),
  })

  const unfreezeMutation = useMutation({
    mutationFn: () => BudgetService.unfreezeBudget(),
    onSuccess: () => {
      showSuccessToast("Budget unfrozen")
      queryClient.invalidateQueries({ queryKey: ["budget"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleRateSubmit = (data: RateFormData) => {
    const dollars = Number(data.monthlyRateDollars)
    updateBudgetMutation.mutate({
      monthly_rate_cents: dollarsToCents(dollars),
    })
  }

  const handleCooloffSubmit = (data: CooloffFormData) => {
    updateBudgetMutation.mutate({
      cooloff_scaling_cents: data.scalingDollars
        ? dollarsToCents(Number(data.scalingDollars))
        : null,
      cooloff_scaling_days: Number(data.scalingDays) || 3,
      cooloff_min_threshold_cents: data.thresholdDollars
        ? dollarsToCents(Number(data.thresholdDollars))
        : null,
      cooloff_min_threshold_days: Number(data.thresholdDays) || 7,
      cooloff_max_days: data.maxDays ? Number(data.maxDays) : null,
      freeze_penalty_days: Number(data.freezePenaltyDays) || 7,
    })
  }

  const handleAdjustBalance = (deltaDollars: number) => {
    if (!budget) return

    const currentCents = calculateCurrentCents(budget)
    const newCents = Math.max(0, currentCents + dollarsToCents(deltaDollars))

    updateBudgetMutation.mutate({
      cents_at_last_update: Math.round(newCents),
    })
  }

  const handleSetExactBalance = () => {
    const dollars = Number.parseFloat(setExactAmount)
    if (Number.isNaN(dollars) || dollars < 0) return

    updateBudgetMutation.mutate({
      cents_at_last_update: dollarsToCents(dollars),
    })
  }

  if (isLoading) {
    return (
      <div className="max-w-md animate-pulse space-y-4">
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
        <div className="h-6 w-32 rounded bg-muted" />
        <div className="h-20 w-full rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-8">
      <h3 className="text-lg font-semibold">Budget Settings</h3>

      <MonthlyRateSection
        form={rateForm}
        onSubmit={handleRateSubmit}
        isPending={updateBudgetMutation.isPending}
      />

      <BalanceSection
        adjustMode={adjustMode}
        onAdjustModeChange={setAdjustMode}
        adjustAmount={adjustAmount}
        onAdjustAmountChange={setAdjustAmount}
        setExactAmount={setExactAmount}
        onSetExactAmountChange={setSetExactAmount}
        onAdjustBalance={handleAdjustBalance}
        onSetExactBalance={handleSetExactBalance}
        isPending={updateBudgetMutation.isPending}
      />

      {isFrozen && (
        <FreezeSection
          onUnfreeze={() => unfreezeMutation.mutate()}
          isPending={unfreezeMutation.isPending}
        />
      )}

      <CooloffSection
        form={cooloffForm}
        onSubmit={handleCooloffSubmit}
        isPending={updateBudgetMutation.isPending}
      />
    </div>
  )
}

export default BudgetSettings
