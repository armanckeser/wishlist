import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"

import { WishlistService } from "@/client"
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
import { useSelection } from "@/contexts/SelectionContext"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Confirmation dialog for bulk deleting selected items.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
}: BulkDeleteDialogProps) {
  const { userId } = useParams({ from: "/_layout/$userId" })
  const { selectedIds, selectedCount, exitSelectionMode } = useSelection()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      WishlistService.bulkDeleteItemsEndpoint({
        requestBody: { item_ids: Array.from(selectedIds) },
      }),
    onSuccess: (data) => {
      showSuccessToast(`Deleted ${data.deleted_count} items`)
      queryClient.invalidateQueries({ queryKey: ["wishlist", "user", userId] })
      exitSelectionMode()
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {selectedCount} items?</AlertDialogTitle>
          <AlertDialogDescription>
            This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
