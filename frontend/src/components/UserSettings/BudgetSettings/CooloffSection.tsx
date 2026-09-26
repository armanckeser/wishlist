import type { UseFormReturn } from "react-hook-form"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { dollarsToCents } from "@/lib/budget"

import { CooloffExample } from "./CooloffExample"
import type { CooloffFormData } from "./types"

interface CooloffSectionProps {
  form: UseFormReturn<CooloffFormData>
  onSubmit: (data: CooloffFormData) => void
  isPending: boolean
}

export function CooloffSection({
  form,
  onSubmit,
  isPending,
}: CooloffSectionProps) {
  const watchedSettings = {
    cooloff_scaling_cents: form.watch("scalingDollars")
      ? dollarsToCents(Number(form.watch("scalingDollars")))
      : null,
    cooloff_scaling_days: Number(form.watch("scalingDays")) || 3,
    cooloff_min_threshold_cents: form.watch("thresholdDollars")
      ? dollarsToCents(Number(form.watch("thresholdDollars")))
      : null,
    cooloff_min_threshold_days: Number(form.watch("thresholdDays")) || 7,
    cooloff_max_days: form.watch("maxDays")
      ? Number(form.watch("maxDays"))
      : null,
  }

  const freezePenaltyDays = Number(form.watch("freezePenaltyDays")) || 7

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h4 className="text-sm font-medium">Cool-off Settings</h4>
        <p className="text-sm text-muted-foreground">
          Encourage delayed gratification by requiring wait time before purchase
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Expensive Item Threshold */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Items over</span>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="pl-6"
                  {...form.register("thresholdDollars")}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                need at least
              </span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="w-16"
                {...form.register("thresholdDays")}
              />
              <span className="text-sm text-muted-foreground">
                days to cool off
              </span>
            </div>
          </div>

          {/* Price-based Scaling with Maximum */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">For every</span>
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  className="pl-6"
                  {...form.register("scalingDollars")}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                an item needs
              </span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="w-16"
                {...form.register("scalingDays")}
              />
              <span className="text-sm text-muted-foreground">
                days to cool off with a maximum of
              </span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="w-16"
                placeholder="None"
                {...form.register("maxDays")}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* Freeze Penalty */}
          <FormField
            control={form.control}
            name="freezePenaltyDays"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      If you buy before cool-off ends, budget freezes for
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      className="w-16"
                      {...field}
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dynamic Example */}
          <CooloffExample
            settings={watchedSettings}
            freezePenaltyDays={freezePenaltyDays}
          />

          <LoadingButton
            type="submit"
            loading={isPending}
            disabled={!form.formState.isDirty}
          >
            Save cool-off settings
          </LoadingButton>
        </form>
      </Form>
    </div>
  )
}
