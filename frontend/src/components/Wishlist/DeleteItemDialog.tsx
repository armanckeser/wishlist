import { useMutation, useQueryClient } from "@tanstack/react-query"

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
import useCustomToast from "@/hooks/useCustomToast"
import type { WishlistItemPublic } from "@/types"
import { handleError } from "@/utils"

interface DeleteItemDialogProps {
  item: WishlistItemPublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Confirmation dialog for deleting a wishlist item.
 */
export function DeleteItemDialog({
  item,
  open,
  onOpenChange,
}: DeleteItemDialogProps) {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (itemId: string) => WishlistService.deleteItem({ itemId }),
    onSuccess: () => {
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
  })

  const handleDelete = () => {
    if (item) {
      mutation.mutate(item.id)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from wishlist?</AlertDialogTitle>
          <AlertDialogDescription>
            {item && (
              <>
                <span className="font-medium text-foreground">
                  {item.title}
                </span>{" "}
                will be permanently removed from your wishlist.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
