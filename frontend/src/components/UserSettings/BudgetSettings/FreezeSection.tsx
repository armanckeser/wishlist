import { LoadingButton } from "@/components/ui/loading-button"

interface FreezeSectionProps {
  onUnfreeze: () => void
  isPending: boolean
}

export function FreezeSection({ onUnfreeze, isPending }: FreezeSectionProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h4 className="text-sm font-medium">Budget Frozen</h4>
        <p className="text-sm text-muted-foreground">
          Your budget is currently frozen and not accruing. You can manually
          unfreeze it below.
        </p>
      </div>
      <LoadingButton
        type="button"
        variant="outline"
        onClick={onUnfreeze}
        loading={isPending}
      >
        Unfreeze Budget
      </LoadingButton>
    </div>
  )
}
