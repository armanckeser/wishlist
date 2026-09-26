import { z } from "zod"

import type { CooloffSettings } from "@/contexts/CooloffContext"

export const rateFormSchema = z.object({
  monthlyRateDollars: z
    .string()
    .min(1, "Monthly rate is required")
    .refine((val) => !Number.isNaN(Number(val)), "Must be a valid number")
    .refine((val) => Number(val) >= 0, "Monthly rate must be positive")
    .refine((val) => Number(val) <= 100000, "Monthly rate seems too high"),
})

export type RateFormData = z.infer<typeof rateFormSchema>

export const cooloffFormSchema = z.object({
  scalingDollars: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
  scalingDays: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
  thresholdDollars: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
  thresholdDays: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
  maxDays: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
  freezePenaltyDays: z
    .string()
    .refine((val) => !val || Number(val) >= 0, "Must be 0 or more"),
})

export type CooloffFormData = z.infer<typeof cooloffFormSchema>

export type AdjustMode = "adjust" | "set"

export interface CooloffExampleProps {
  settings: CooloffSettings
  freezePenaltyDays: number
}
