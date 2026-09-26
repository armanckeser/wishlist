import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronRight, Loader2, RefreshCw, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import {
  type ParseUrlResponse,
  type TrackingParseResponse,
  TrackingService,
  UrlParserService,
} from "@/client"
import { CategoryPicker } from "@/components/Categories/CategoryPicker"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { useAddItemPrefillOptional } from "@/contexts/AddItemPrefillContext"
import useCustomToast from "@/hooks/useCustomToast"
import { isUsefulParseResult } from "@/utils/parseValidation"

const formSchema = z.object({
  product_url: z.string().url().optional().or(z.literal("")),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  price: z.string().optional().or(z.literal("")),
  image_url: z.string().url().optional().or(z.literal("")),
  category_ids: z.array(z.string()),
})

export type ItemFormData = z.infer<typeof formSchema>

export interface ItemFormValues {
  title: string
  description?: string
  price_cents: number
  image_url?: string
  product_url?: string
  category_ids: string[]
  /** Tracking-specific fields */
  tracking_number?: string
  tracking_carrier?: string
  tracking_url?: string
  /**
   * True when the submitted price is exactly what we parsed from the
   * submitted product URL. Lets the backend turn on price tracking only for
   * pages it has proven it can read.
   */
  price_from_url?: boolean
}

export interface ItemFormInitialValues {
  title: string
  description?: string | null
  price_cents: number
  image_url?: string | null
  product_url?: string | null
  category_ids?: string[]
  /** Tracking fields for purchased/gifted items */
  tracking_number?: string
  tracking_carrier?: string
  tracking_url?: string
}

interface ItemFormProps {
  /** Initial values for edit mode or share target */
  initialValues?: ItemFormInitialValues
  /** Submit handler receives validated form values */
  onSubmit: (values: ItemFormValues) => void
  /** Called when cancel is clicked */
  onCancel: () => void
  /** Whether form submission is in progress */
  isSubmitting?: boolean
  /** Button text for submit (defaults to "Save") */
  submitLabel?: string
  /** Auto-parse the initial product URL on mount (for share target flow) */
  autoParseUrl?: boolean
  /** Enable tracking mode - shows tracking input at top (for adding new tracking items) */
  trackingMode?: boolean
  /** Show tracking fields for editing items that already have/can have tracking */
  showTrackingFields?: boolean
  /** Called when the user taps the categories trigger to drill into the picker */
  onOpenCategories?: () => void
  /** Called whenever category selection or parsed metadata change, so the parent
   *  can render a sibling drill-down panel using the same state. */
  onCategoryStateChange?: (state: {
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
    productMetadata: ParsedMetadata
  }) => void
  /** Stable form id, so an external submit button (e.g. in the dialog header)
   *  can submit via `<button type="submit" form={formId}>`. */
  formId?: string
  /** When true, hide the inline Cancel/Save footer (parent renders its own). */
  hideFooter?: boolean
}

/**
 * Shared form component for adding and editing wishlist items.
 * Includes URL parsing functionality for auto-filling product details.
 *
 * Note: To reset form values when switching items, use React's key prop
 * on the parent to force remount (e.g., key={item.id}).
 */
/** Parsed product metadata for category suggestions */
interface ParsedMetadata {
  product_url?: string
  title?: string
  brand?: string
  breadcrumbs?: string[]
  category?: string
}

/**
 * Submit the surrounding form on Enter. Use on the URL input so pressing
 * the keyboard's "Go" key submits.
 */
const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== "Enter") return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

/**
 * A tap-to-open row for a secondary form field. Uses native <details>/
 * <summary> per modern-web-guidance/search-hidden-content — gets aria-
 * expanded, keyboard support, and find-in-page integration for free.
 *
 * Layout: summary shows label + current value (or placeholder hint) +
 * chevron; the detail body holds the actual input.
 *
 * On expand, the first focusable input inside the body is focused so the
 * user can type immediately (single tap, not double tap).
 */
function FieldRow({
  label,
  required,
  value,
  placeholder,
  open,
  onToggle,
  children,
}: {
  label: string
  required?: boolean
  /** Current displayable value (formatted). Empty = placeholder shows. */
  value: string
  placeholder: string
  /** Controlled open state, so we can auto-expand on validation error. */
  open: boolean
  onToggle: (open: boolean) => void
  /** The expanded input. */
  children: React.ReactNode
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null)
  return (
    <details
      open={open}
      onToggle={(event) => {
        const isOpen = event.currentTarget.open
        onToggle(isOpen)
        // Focus the first input inside on expand so the keyboard appears
        // and the user can type without a second tap. Run on next tick so
        // the body has actually expanded.
        if (isOpen) {
          requestAnimationFrame(() => {
            const input =
              bodyRef.current?.querySelector<HTMLElement>("input, textarea")
            input?.focus()
          })
        }
      }}
      className="group border-t first:border-t-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={
              value
                ? "max-w-[180px] truncate text-base text-foreground"
                : "text-base text-muted-foreground"
            }
          >
            {value || placeholder}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div ref={bodyRef} className="pb-3">
        {children}
      </div>
    </details>
  )
}

const toParsedMetadata = (
  result?: ParseUrlResponse,
  url?: string,
): ParsedMetadata => {
  if (!result) return {}
  return {
    product_url: url ?? result.source_url,
    title: result.title ?? undefined,
    brand: result.brand ?? undefined,
    breadcrumbs: result.breadcrumbs ?? undefined,
    category: result.category ?? undefined,
  }
}

export function ItemForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save",
  autoParseUrl = false,
  trackingMode = false,
  showTrackingFields = false,
  onOpenCategories,
  onCategoryStateChange,
  formId,
  hideFooter = false,
}: ItemFormProps) {
  const [isParsing, setIsParsing] = useState(false)
  const [parseSuccess, setParseSuccess] = useState(false)
  const [parsedMetadata, setParsedMetadata] = useState<ParsedMetadata>({})
  const [autoFilled, setAutoFilled] = useState(false)
  // Price (in cents) the URL parser returned, if any. Compared against the
  // submitted price to decide whether automatic price tracking can start.
  const [parsedPriceCents, setParsedPriceCents] = useState<number | null>(null)

  // Expanded state for the secondary field rows (Title/Price/Image/Notes).
  // Default collapsed; auto-expand a row if its field has a validation
  // error so the user sees what to fix.
  const [expandedRows, setExpandedRows] = useState<{
    title: boolean
    price: boolean
    image_url: boolean
    description: boolean
  }>({ title: false, price: false, image_url: false, description: false })
  const { showErrorToast } = useCustomToast()

  // Show tracking section if either tracking mode (new item) or editing item with tracking
  const showTracking = trackingMode || showTrackingFields

  // Tracking mode state - initialize from initial values if editing
  const [trackingInput, setTrackingInput] = useState(
    initialValues?.tracking_number ?? "",
  )
  const [isParsingTracking, setIsParsingTracking] = useState(false)
  const [trackingResult, setTrackingResult] =
    useState<TrackingParseResponse | null>(
      // If we have initial tracking data, create a mock result to show it's valid
      initialValues?.tracking_number
        ? {
            tracking_number: initialValues.tracking_number,
            carrier: initialValues.tracking_carrier ?? null,
            carrier_code: null,
            is_valid: true,
            tracking_url: initialValues.tracking_url ?? null,
          }
        : null,
    )
  // Track if auto-parse has run to ensure it only happens once on mount
  const hasAutoParseRun = useRef(false)
  // Connect to prefill context for cancel functionality
  const prefillContext = useAddItemPrefillOptional()

  const form = useForm<ItemFormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      product_url: initialValues?.product_url ?? "",
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      price: initialValues?.price_cents
        ? (initialValues.price_cents / 100).toFixed(2)
        : "",
      image_url: initialValues?.image_url ?? "",
      category_ids: initialValues?.category_ids ?? [],
    },
  })

  // Bridge category selection + parsed metadata up to the dialog so it can
  // render a sibling drill-down pane that writes back to the same field.
  // We use useWatch to subscribe only to the relevant field; setValue stays
  // stable across renders so the bridged callback identity is also stable.
  const watchedCategoryIds = useWatch({
    control: form.control,
    name: "category_ids",
  })
  const setCategoryIds = useCallback(
    (ids: string[]) => {
      form.setValue("category_ids", ids, { shouldDirty: true })
    },
    [form],
  )
  useEffect(() => {
    if (!onCategoryStateChange) return
    onCategoryStateChange({
      selectedIds: watchedCategoryIds ?? [],
      onSelectionChange: setCategoryIds,
      productMetadata: parsedMetadata,
    })
  }, [
    watchedCategoryIds,
    setCategoryIds,
    parsedMetadata,
    onCategoryStateChange,
  ])

  // Live values for the collapsed row labels.
  const watchedTitle = useWatch({ control: form.control, name: "title" }) ?? ""
  const watchedPrice = useWatch({ control: form.control, name: "price" }) ?? ""
  const watchedImageUrl =
    useWatch({ control: form.control, name: "image_url" }) ?? ""
  const watchedDescription =
    useWatch({ control: form.control, name: "description" }) ?? ""

  // If the user submits with validation errors on collapsed rows, auto-
  // expand those rows so they can see the problem. We watch formState
  // errors via the form context.
  const formErrors = form.formState.errors
  useEffect(() => {
    setExpandedRows((prev) => ({
      title: prev.title || Boolean(formErrors.title),
      price: prev.price || Boolean(formErrors.price),
      image_url: prev.image_url || Boolean(formErrors.image_url),
      description: prev.description || Boolean(formErrors.description),
    }))
  }, [
    formErrors.title,
    formErrors.price,
    formErrors.image_url,
    formErrors.description,
  ])

  const applyParseResult = useCallback(
    (result: ParseUrlResponse, url: string, isAuto?: boolean) => {
      if (result.title) {
        form.setValue("title", result.title, { shouldValidate: true })
      }
      if (result.price_cents !== null && result.price_cents !== undefined) {
        const priceStr = (result.price_cents / 100).toFixed(2)
        form.setValue("price", priceStr, { shouldValidate: true })
        setParsedPriceCents(result.price_cents)
      } else {
        setParsedPriceCents(null)
      }
      if (result.image_url) {
        form.setValue("image_url", result.image_url, { shouldValidate: true })
      }

      setParsedMetadata(toParsedMetadata(result, url))

      const hasResult = isUsefulParseResult(result)
      setParseSuccess(hasResult)
      if (isAuto !== undefined) {
        setAutoFilled(isAuto && hasResult)
      }
      return hasResult
    },
    [form],
  )

  // Determine if we're in edit mode (has existing item data) vs add mode
  const isEditMode = Boolean(initialValues?.title)

  // Track what we've applied from context (separately for URL and parse result)
  const hasAppliedContextUrl = useRef(false)
  const hasAppliedContextParseResult = useRef(false)

  // Apply URL immediately when clipboard is read (don't wait for parsing)
  useEffect(() => {
    if (isEditMode) return
    if (hasAppliedContextUrl.current) return
    if (!prefillContext?.url) return

    const currentUrl = form.getValues("product_url")
    if (currentUrl) return

    console.log("[ItemForm] Setting URL from context:", prefillContext.url)
    hasAppliedContextUrl.current = true
    form.setValue("product_url", prefillContext.url, { shouldValidate: true })
  }, [isEditMode, prefillContext?.url, form])

  // Apply parse result when it's ready
  useEffect(() => {
    if (isEditMode) return
    if (hasAppliedContextParseResult.current) return
    if (prefillContext?.state !== "ready") return
    if (!prefillContext?.parsedResult || !prefillContext?.url) return

    console.log("[ItemForm] Applying parse results from context")
    hasAppliedContextParseResult.current = true
    applyParseResult(prefillContext.parsedResult, prefillContext.url, true)
  }, [
    isEditMode,
    prefillContext?.state,
    prefillContext?.parsedResult,
    prefillContext?.url,
    applyParseResult,
  ])

  // Parse URL and auto-fill form fields
  const parseUrl = useCallback(
    async (url: string, options?: { isAuto?: boolean }) => {
      if (!url || !url.startsWith("http")) return

      setIsParsing(true)
      setParseSuccess(false)
      try {
        const result = await UrlParserService.parseProductUrl({
          requestBody: { url },
        })

        const hasResult = applyParseResult(result, url, options?.isAuto)
        if (!hasResult) {
          setAutoFilled(false)
        }
      } catch {
        setAutoFilled(false)
        showErrorToast("Couldn't auto-fill. Enter details manually.")
      } finally {
        setIsParsing(false)
      }
    },
    [applyParseResult, showErrorToast],
  )

  // Auto-parse URL on mount if requested (runs once via ref guard)
  // This is an initialization pattern, not a prop-sync pattern
  if (autoParseUrl && !hasAutoParseRun.current && initialValues?.product_url) {
    hasAutoParseRun.current = true
    // Trigger async parse - React handles setState during render for initialization
    parseUrl(initialValues.product_url, { isAuto: true })
  }

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text")
    setTimeout(() => {
      parseUrl(pastedText, { isAuto: false })
    }, 0)
  }

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const url = e.target.value
    // Only parse if we have a URL and title is empty (not already parsed)
    if (url && !form.getValues("title")) {
      parseUrl(url, { isAuto: false })
    }
  }

  const handleUrlChange = useCallback(
    (value: string, shouldParse = false) => {
      if (parsedMetadata.product_url && parsedMetadata.product_url !== value) {
        setParsedMetadata({})
        setParseSuccess(false)
        setAutoFilled(false)
        setParsedPriceCents(null)
      }
      // Auto-parse if it looks like a URL was pasted (iOS paste menu doesn't trigger onPaste)
      if (
        shouldParse &&
        value.startsWith("http") &&
        !parsedMetadata.product_url
      ) {
        parseUrl(value, { isAuto: false })
      }
    },
    [parsedMetadata.product_url, parseUrl],
  )

  const handleClearPrefill = useCallback(() => {
    form.reset({
      product_url: "",
      title: "",
      description: "",
      price: "",
      image_url: "",
      category_ids: [],
    })
    setParsedMetadata({})
    setParseSuccess(false)
    setAutoFilled(false)
    setParsedPriceCents(null)
    // Cancel any in-flight parsing and clear context state
    prefillContext?.cancel()
  }, [form, prefillContext])

  // Parse tracking number or URL
  const parseTrackingInput = useCallback(
    async (input: string) => {
      if (!input.trim()) {
        setTrackingResult(null)
        return
      }

      setIsParsingTracking(true)
      try {
        const result = await TrackingService.parseTracking({
          requestBody: { input: input.trim() },
        })
        setTrackingResult(result)
      } catch {
        showErrorToast("Couldn't parse tracking number. Check the format.")
        setTrackingResult(null)
      } finally {
        setIsParsingTracking(false)
      }
    },
    [showErrorToast],
  )

  const handleTrackingInputChange = (value: string) => {
    setTrackingInput(value)
    // Clear result when input changes
    if (trackingResult) {
      setTrackingResult(null)
    }
  }

  const handleTrackingPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text")
    setTimeout(() => {
      parseTrackingInput(pastedText)
    }, 0)
  }

  const handleTrackingBlur = () => {
    if (trackingInput && !trackingResult) {
      parseTrackingInput(trackingInput)
    }
  }

  const handleFormSubmit = (data: ItemFormData) => {
    // Validate price is required when not in tracking mode
    if (!trackingMode && (!data.price || data.price.trim() === "")) {
      form.setError("price", { message: "Price is required" })
      return
    }

    const priceCents = data.price
      ? Math.round(Number.parseFloat(data.price) * 100)
      : 0

    // Only claim the price came from the URL if the user kept both the
    // parsed URL and the parsed price untouched.
    const priceFromUrl =
      parsedPriceCents !== null &&
      priceCents === parsedPriceCents &&
      Boolean(data.product_url) &&
      data.product_url === parsedMetadata.product_url

    onSubmit({
      title: data.title,
      description: data.description || undefined,
      price_cents: priceCents,
      image_url: data.image_url || undefined,
      product_url: data.product_url || undefined,
      category_ids: data.category_ids,
      price_from_url: priceFromUrl,
      // Include tracking data if showing tracking fields
      ...(showTracking && trackingResult?.is_valid
        ? {
            tracking_number: trackingResult.tracking_number,
            tracking_carrier: trackingResult.carrier ?? undefined,
            tracking_url: trackingResult.tracking_url ?? undefined,
          }
        : showTracking && !trackingInput
          ? {
              // Clear tracking if input was cleared
              tracking_number: undefined,
              tracking_carrier: undefined,
              tracking_url: undefined,
            }
          : {}),
    })
  }

  const showClearButton = autoFilled && parseSuccess

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)}>
        <div className="grid gap-4 py-4">
          {/* Tracking Input - Shown in tracking mode or when editing items with tracking */}
          {showTracking && (
            <div className="space-y-2">
              <label
                htmlFor="tracking-input"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Tracking Number or URL{" "}
                {trackingMode ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="tracking-input"
                    data-testid="tracking-number-input"
                    placeholder="Paste tracking number or URL..."
                    value={trackingInput}
                    onChange={(e) => handleTrackingInputChange(e.target.value)}
                    onPaste={handleTrackingPaste}
                    onBlur={handleTrackingBlur}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    onKeyDown={submitOnEnter}
                    disabled={isParsingTracking}
                    className={
                      trackingResult?.is_valid
                        ? "ring-2 ring-emerald-500 border-emerald-500"
                        : trackingResult && !trackingResult.is_valid
                          ? "ring-2 ring-destructive border-destructive"
                          : undefined
                    }
                    autoFocus={trackingMode}
                  />
                  {isParsingTracking && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {trackingInput && !isParsingTracking && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => parseTrackingInput(trackingInput)}
                    title="Parse tracking number"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {/* Carrier detection result */}
              {trackingResult && (
                <div
                  data-testid="tracking-carrier-result"
                  className={`flex items-center gap-2 text-sm ${
                    trackingResult.is_valid
                      ? "text-emerald-600"
                      : "text-destructive"
                  }`}
                >
                  {trackingResult.is_valid ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span data-testid="tracking-carrier-name">
                        {trackingResult.carrier ?? "Carrier"} detected
                      </span>
                    </>
                  ) : (
                    <span>Invalid tracking number format</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Product URL — primary field, top of form (F-pattern read order).
              Autofocused in add mode so the keyboard opens immediately and
              iOS surfaces a Paste suggestion in the predictive bar when
              the clipboard contains a URL. */}
          <FormField
            control={form.control}
            name="product_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Product Link{" "}
                  {trackingMode && (
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        {...field}
                        placeholder="Paste product URL to auto-fill…"
                        type="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        onKeyDown={submitOnEnter}
                        onChange={(e) => {
                          const newValue = e.target.value
                          const oldValue = field.value || ""
                          field.onChange(e)
                          const isPaste = newValue.length - oldValue.length > 5
                          handleUrlChange(newValue, isPaste)
                        }}
                        onPaste={handleUrlPaste}
                        onBlur={(e) => {
                          field.onBlur()
                          handleUrlBlur(e)
                        }}
                        disabled={isParsing}
                        className={
                          parseSuccess
                            ? "ring-2 ring-emerald-500 border-emerald-500"
                            : undefined
                        }
                        autoFocus={!initialValues?.title}
                      />
                      {isParsing && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {field.value &&
                      !isParsing &&
                      (showClearButton ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleClearPrefill}
                          title="Clear auto-filled details"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            parseUrl(field.value ?? "", { isAuto: false })
                          }
                          title="Re-fetch product details"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Categories — drill-down trigger (already a row) */}
          <FormField
            control={form.control}
            name="category_ids"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <CategoryPicker
                    value={field.value}
                    onChange={(ids) => field.onChange(ids)}
                    onOpen={() => onOpenCategories?.()}
                    productMetadata={parsedMetadata}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Secondary attributes — collapsed rows, tap to edit. iOS-canonical
              "list of attributes" pattern (Reminders / Things / Notes). */}
          <div className="rounded-lg border bg-card/40">
            <div className="px-3">
              {/* Title */}
              <FieldRow
                label="Name"
                required
                value={watchedTitle}
                placeholder="Tap to add"
                open={expandedRows.title}
                onToggle={(open) =>
                  setExpandedRows((prev) => ({ ...prev, title: open }))
                }
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="e.g. Croissant Dôme Ring"
                          type="text"
                          autoCapitalize="words"
                          autoCorrect="on"
                          spellCheck
                          enterKeyHint="done"
                          onKeyDown={submitOnEnter}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldRow>

              {/* Price */}
              <FieldRow
                label="Price"
                required={!trackingMode}
                value={watchedPrice ? `$${watchedPrice}` : ""}
                placeholder="Tap to add"
                open={expandedRows.price}
                onToggle={(open) =>
                  setExpandedRows((prev) => ({ ...prev, price: open }))
                }
              >
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            placeholder="0.00"
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            autoComplete="off"
                            enterKeyHint="done"
                            onKeyDown={submitOnEnter}
                            className="pl-7"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldRow>

              {/* Image URL */}
              <FieldRow
                label="Image"
                value={watchedImageUrl ? "Image set" : ""}
                placeholder="Auto from URL"
                open={expandedRows.image_url}
                onToggle={(open) =>
                  setExpandedRows((prev) => ({ ...prev, image_url: open }))
                }
              >
                <FormField
                  control={form.control}
                  name="image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="https://..."
                          type="url"
                          autoComplete="off"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          enterKeyHint="done"
                          onKeyDown={submitOnEnter}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldRow>

              {/* Notes — textarea, autosizes via field-sizing */}
              <FieldRow
                label="Notes"
                value={watchedDescription}
                placeholder="Tap to add"
                open={expandedRows.description}
                onToggle={(open) =>
                  setExpandedRows((prev) => ({ ...prev, description: open }))
                }
              >
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Size, color, or other details..."
                          autoCapitalize="sentences"
                          autoCorrect="on"
                          spellCheck
                          enterKeyHint="done"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FieldRow>
            </div>
          </div>
        </div>

        {!hideFooter && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isParsing}
            >
              Cancel
            </Button>
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              disabled={isParsing}
            >
              {submitLabel}
            </LoadingButton>
          </div>
        )}
      </form>
    </Form>
  )
}
