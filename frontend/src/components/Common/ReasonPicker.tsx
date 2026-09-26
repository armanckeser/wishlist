import { Check } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface ReasonOption {
  label: string
  value: string
}

interface ReasonPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  options: ReasonOption[]
  onConfirm: (reason: string) => void
  confirmLabel?: string
  confirmingLabel?: string
  isPending?: boolean
}

/**
 * Reusable dialog for selecting or entering a reason.
 * Shows preset options as chips and allows custom text input.
 */
export function ReasonPicker({
  open,
  onOpenChange,
  title,
  description,
  options,
  onConfirm,
  confirmLabel = "Confirm",
  confirmingLabel = "Confirming...",
  isPending = false,
}: ReasonPickerProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState("")

  const handleOptionClick = (value: string) => {
    setSelectedOption(value)
    setCustomReason("")
  }

  const handleCustomChange = (value: string) => {
    setCustomReason(value)
    setSelectedOption(null)
  }

  const handleConfirm = () => {
    const reason = selectedOption || customReason.trim()
    if (reason) {
      onConfirm(reason)
    }
  }

  const hasReason = selectedOption || customReason.trim()

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedOption(null)
      setCustomReason("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}
        >
          <div className="space-y-4 py-4">
            {/* Preset options as chips */}
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionClick(option.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                    "border",
                    selectedOption === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {selectedOption === option.value && (
                    <Check className="h-3 w-3" />
                  )}
                  {option.label}
                </button>
              ))}
            </div>

            {/* Custom reason input */}
            <div className="space-y-2">
              <label
                htmlFor="custom-reason"
                className="text-sm text-muted-foreground"
              >
                Or enter your own:
              </label>
              <Input
                id="custom-reason"
                placeholder="Type a reason..."
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="done"
                value={customReason}
                onChange={(e) => handleCustomChange(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!hasReason || isPending}>
              {isPending ? confirmingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
