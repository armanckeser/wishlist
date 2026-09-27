import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useId, useMemo, useRef, useState } from "react"

import {
  TrackingService,
  type WishlistItemCreate,
  type WishlistItemUpdate,
  WishlistService,
} from "@/client"
import { useCategorySelection } from "@/components/Categories/CategoryCommandView"
import { CategoryPanel } from "@/components/Categories/CategoryPanel"
import { Button } from "@/components/ui/button"
import { DrillDownStack } from "@/components/ui/drill-down-stack"
import { LoadingButton } from "@/components/ui/loading-button"
import { NativeDialog } from "@/components/ui/native-dialog"
import { useAddItemPrefillOptional } from "@/contexts/AddItemPrefillContext"
import useCustomToast from "@/hooks/useCustomToast"
import type { WishlistItemPublic } from "@/types"
import { handleError } from "@/utils"

import { ItemForm, type ItemFormValues } from "./ItemForm"

interface BaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AddModeProps extends BaseDialogProps {
  mode: "add"
  item?: never
  trackingMode?: boolean
  shareTargetUrl?: string
}

interface EditModeProps extends BaseDialogProps {
  mode: "edit"
  item: WishlistItemPublic | null
  trackingMode?: never
  shareTargetUrl?: never
}

type ItemDialogProps = AddModeProps | EditModeProps

interface CategoryBridgeState {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  productMetadata: {
    product_url?: string
    title?: string
    brand?: string
    breadcrumbs?: string[]
    category?: string
  }
}

/**
 * Unified dialog for adding or editing wishlist items.
 * Hosts a 2-pane drill-down stack: pane 0 = form, pane 1 = category picker.
 * The native scroll-snap gesture handles swipe-back-to-form on iOS.
 */
export function ItemDialog(props: ItemDialogProps) {
  const { open, onOpenChange, mode } = props
  const queryClient = useQueryClient()
  const { showErrorToast, showSuccessToast } = useCustomToast()
  const prefillUsedRef = useRef(false)

  const prefillContext = useAddItemPrefillOptional()

  // Drill-down stack state
  const [activePane, setActivePane] = useState<0 | 1>(0)

  // Stable form id for the external submit button in the nav bar.
  // Strip colons that React's useId returns — they're valid in HTML ids but
  // make CSS selectors awkward.
  const itemFormId = `item-form-${useId().replace(/:/g, "")}`

  // Bridge to the form's category selection — set via render-prop from ItemForm
  const [categoryBridge, setCategoryBridge] =
    useState<CategoryBridgeState | null>(null)

  // Reset to root pane whenever the drawer closes/opens
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setActivePane(0)
      onOpenChange(next)
    },
    [onOpenChange],
  )

  const createMutation = useMutation({
    mutationFn: (data: WishlistItemCreate) =>
      WishlistService.createItem({ requestBody: data }),
    onSuccess: () => {
      if (prefillUsedRef.current && prefillContext) {
        prefillContext.clear()
      }
      prefillUsedRef.current = false

      const message =
        props.mode === "add" && props.trackingMode
          ? "Package added to tracking"
          : "Item added to wishlist"
      showSuccessToast(message)

      handleOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
      if (props.mode === "add" && props.trackingMode) {
        queryClient.invalidateQueries({ queryKey: ["tracking"] })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      itemId,
      data,
      hadTrackingBefore,
    }: {
      itemId: string
      data: WishlistItemUpdate
      hadTrackingBefore: boolean
    }) => {
      const result = await WishlistService.updateItem({
        itemId,
        requestBody: data,
      })
      const trackingWasAdded = !hadTrackingBefore && data.tracking_number
      if (trackingWasAdded) {
        try {
          await TrackingService.syncTracking({ itemId })
        } catch {
          // Sync failed but update succeeded — status will sync in background
        }
      }
      return result
    },
    onSuccess: () => {
      showSuccessToast("Item updated")
      handleOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
  })

  const handleSubmit = (values: ItemFormValues) => {
    if (mode === "add") {
      prefillUsedRef.current =
        prefillContext?.state === "ready" &&
        values.product_url === prefillContext.url

      createMutation.mutate({
        title: values.title,
        description: values.description,
        price_cents: values.price_cents,
        image_url: values.image_url,
        product_url: values.product_url,
        category_ids: values.category_ids,
        tracking_number: values.tracking_number,
        tracking_carrier: values.tracking_carrier,
        tracking_url: values.tracking_url,
        price_from_url: values.price_from_url ?? false,
      })
    } else {
      if (!props.item) return
      const hadTrackingBefore =
        "tracking_number" in props.item && Boolean(props.item.tracking_number)

      updateMutation.mutate({
        itemId: props.item.id,
        data: {
          title: values.title,
          description: values.description ?? null,
          price_cents: values.price_cents,
          image_url: values.image_url ?? null,
          product_url: values.product_url ?? null,
          category_ids: values.category_ids,
          tracking_number: values.tracking_number ?? null,
          tracking_carrier: values.tracking_carrier ?? null,
          tracking_url: values.tracking_url ?? null,
        },
        hadTrackingBefore,
      })
    }
  }

  const initialValues = useMemo(() => {
    if (mode === "add") {
      return props.shareTargetUrl
        ? {
            title: "",
            price_cents: 0,
            image_url: "",
            product_url: props.shareTargetUrl,
            category_ids: [],
          }
        : undefined
    }
    const item = props.item
    return item
      ? {
          title: item.title,
          description: item.description,
          price_cents: item.price_cents,
          image_url: item.image_url,
          product_url: item.product_url,
          category_ids: item.categories?.map((category) => category.id) ?? [],
          tracking_number:
            "tracking_number" in item
              ? (item.tracking_number ?? undefined)
              : undefined,
          tracking_carrier:
            "tracking_carrier" in item
              ? (item.tracking_carrier ?? undefined)
              : undefined,
          tracking_url:
            "tracking_url" in item
              ? (item.tracking_url ?? undefined)
              : undefined,
        }
      : undefined
  }, [mode, props])

  const showTrackingFields =
    mode === "add"
      ? props.trackingMode
      : props.item?.status === "purchased" ||
        props.item?.status === "gifted" ||
        props.item?.status === "tracking"

  const isSubmitting =
    mode === "add" ? createMutation.isPending : updateMutation.isPending

  const title =
    mode === "add"
      ? props.trackingMode
        ? "Track Package"
        : "Add Item"
      : "Edit Item"
  const description =
    mode === "add"
      ? props.trackingMode
        ? "Paste a tracking number or link."
        : "Paste a product link, or fill it in yourself."
      : "Paste a new link to refresh the details."

  const submitLabel = mode === "add" ? "Save" : "Save Changes"

  const shouldRenderForm = mode === "add" || props.item

  // Selection state hook for the drill-down panel — uses the bridged values
  // from ItemForm so the panel writes back into the same form field.
  const categorySelectionState = useCategorySelection({
    selectedIds: categoryBridge?.selectedIds ?? [],
    onSelectionChange: categoryBridge?.onSelectionChange ?? (() => {}),
  })

  return (
    <NativeDialog
      open={open}
      onOpenChange={handleOpenChange}
      ariaLabel={title}
      // No light-dismiss: there's an explicit Cancel button and accidental
      // backdrop taps would lose unsaved form input.
      closeOnBackdropClick={false}
      // If we're drilled into the category pane, swipe-back / Esc should
      // pop back to the form rather than close the whole dialog.
      onCancel={() => {
        if (activePane === 1) {
          setActivePane(0)
          return true
        }
        return false
      }}
    >
      <DrillDownStack
        activeIndex={activePane}
        onActiveIndexChange={setActivePane}
        className="flex-1 min-h-0"
        root={
          <div className="flex h-full flex-col">
            {/* Compact title strip — no actions here. The action bar lives
                at the bottom for thumb-reach. */}
            <div className="flex items-center justify-center border-b bg-card px-4 py-3">
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <p className="sr-only">{description}</p>
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
              {shouldRenderForm && (
                <ItemForm
                  key={mode === "edit" ? props.item?.id : "add"}
                  initialValues={initialValues}
                  onSubmit={handleSubmit}
                  onCancel={() => handleOpenChange(false)}
                  isSubmitting={isSubmitting}
                  submitLabel={submitLabel}
                  autoParseUrl={mode === "add" && Boolean(props.shareTargetUrl)}
                  trackingMode={mode === "add" && props.trackingMode}
                  showTrackingFields={showTrackingFields}
                  onOpenCategories={() => setActivePane(1)}
                  onCategoryStateChange={setCategoryBridge}
                  formId={itemFormId}
                  hideFooter
                />
              )}
            </div>
            {/* iOS-style bottom toolbar: thin bar with plain Cancel on the
                left and a compact filled Save on the right. Sits in the
                thumb zone; safe-area inset clears the home indicator. */}
            <div
              className="flex items-center justify-between border-t bg-card/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80"
              style={{
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
              }}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="h-9 px-2 text-base font-normal text-primary"
              >
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                form={itemFormId}
                loading={isSubmitting}
                className="h-9 px-5 text-base font-semibold"
              >
                {submitLabel}
              </LoadingButton>
            </div>
          </div>
        }
        drillDown={
          categoryBridge ? (
            <CategoryPanel
              state={categorySelectionState}
              onBack={() => setActivePane(0)}
            />
          ) : null
        }
      />
    </NativeDialog>
  )
}
