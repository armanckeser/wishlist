import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { useState } from "react"

import { WishlistService } from "@/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

import { useWishlistItem } from "../../context"

interface WaiveCooldownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for waiving cooldown period on a wishlisted item.
 * Requires a reason and shows warning about the action being permanent.
 */
export function WaiveCooldownDialog({
  open,
  onOpenChange,
}: WaiveCooldownDialogProps) {
  const { item, maturity } = useWishlistItem()
  const [reason, setReason] = useState("")
  const queryClient = useQueryClient()
  const { showErrorToast, showSuccessToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: () =>
      WishlistService.waiveCooldown({
        itemId: item.id,
        requestBody: { reason },
      }),
    onSuccess: () => {
      showSuccessToast("Cooldown waived")
      onOpenChange(false)
      setReason("")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
      queryClient.invalidateQueries({ queryKey: ["budget"] })
    },
  })

  const handleConfirm = () => {
    if (!reason.trim()) return
    mutation.mutate()
  }

  const daysRequired = Math.ceil(maturity.daysRequired)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Waive Cooldown Period</AlertDialogTitle>
          <AlertDialogDescription>
            This will allow you to purchase <strong>{item.title}</strong>{" "}
            immediately, bypassing the {daysRequired}-day cooldown requirement.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (required)</Label>
            <Input
              id="reason"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="done"
              placeholder="Why are you waiving the cooldown? (e.g., repurchase)"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setReason(e.target.value)
              }
              maxLength={500}
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Adds a permanent note to this item.
            </AlertDescription>
          </Alert>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || mutation.isPending}
          >
            {mutation.isPending ? "Waiving..." : "Waive Cooldown"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
