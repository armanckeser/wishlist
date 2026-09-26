import type { UseFormReturn } from "react-hook-form"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"

import type { RateFormData } from "./types"

interface MonthlyRateSectionProps {
  form: UseFormReturn<RateFormData>
  onSubmit: (data: RateFormData) => void
  isPending: boolean
}

export function MonthlyRateSection({
  form,
  onSubmit,
  isPending,
}: MonthlyRateSectionProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="monthlyRateDollars"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly budget rate</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                    enterKeyHint="done"
                    className="pl-7"
                    {...field}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    /month
                  </span>
                </div>
              </FormControl>
              <FormDescription>
                Your budget increases by this amount each month
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <LoadingButton
          type="submit"
          loading={isPending}
          disabled={!form.formState.isDirty}
        >
          Save rate
        </LoadingButton>
      </form>
    </Form>
  )
}
