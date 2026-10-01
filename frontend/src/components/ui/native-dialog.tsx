import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Thin wrapper around the native `<dialog>` element opened via showModal().
 *
 * Why native dialog and not a JS library:
 *   - Top-layer rendering: immune to z-index / overflow-clip stacking issues.
 *   - iOS Safari does NOT push the document up to chase a focused input
 *     when the input is inside a top-layer dialog — the browser scrolls
 *     within the nearest scrollable ancestor (the inner overflow-y:auto
 *     container) instead. That's the specific behavior that fixes the
 *     "sheet flies off-screen when keyboard opens" failure mode of
 *     fixed-positioned drawers like vaul / Radix Dialog.
 *   - Document inerting, ::backdrop, and Esc-to-close are platform
 *     behaviors — no useScrollLock, no Esc handler, no inert-management
 *     code needed.
 */

interface NativeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Optional className applied to the <dialog> element. */
  className?: string
  /** Accessible label, used as aria-label on the <dialog>. */
  ariaLabel?: string
  /**
   * Light-dismiss: tap on the ::backdrop closes. Default true.
   * Set to false for forms with unsaved input where accidental dismiss
   * would lose data — the user has to use the Cancel button.
   */
  closeOnBackdropClick?: boolean
  /**
   * Intercept the dialog's `cancel` event (Esc key, mobile back gesture,
   * swipe-back). Return true from the handler to consume the cancel and
   * keep the dialog open — useful when an internal pane should pop back
   * to the root instead of closing the entire dialog.
   */
  onCancel?: () => boolean | void
}

export function NativeDialog({
  open,
  onOpenChange,
  children,
  className,
  ariaLabel,
  closeOnBackdropClick = true,
  onCancel,
}: NativeDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null)

  // Drive the platform open/close state from the `open` prop.
  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      try {
        dialog.showModal()
      } catch {
        // showModal throws if already open or if the element is not
        // connected. Both cases are recoverable: the next render reconciles.
      }
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // The browser fires a `close` event when the dialog is dismissed by
  // any means (Esc, dialog.close(), close button). Use it as the single
  // source of truth for "the dialog is now closed" so swipe-to-back,
  // Esc, and explicit close all converge in one handler.
  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onOpenChange(false)
    dialog.addEventListener("close", handleClose)
    return () => dialog.removeEventListener("close", handleClose)
  }, [onOpenChange])

  // Light-dismiss: a tap on the dialog element where the click target IS
  // the dialog itself (not a child) means the user clicked the backdrop
  // area. The native ::backdrop pseudo-element receives clicks as the
  // dialog itself, per the spec.
  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdropClick) return
    if (event.target === event.currentTarget) {
      onOpenChange(false)
    }
  }

  // Intercept the `cancel` event (Esc key / mobile back gesture). Calling
  // preventDefault() on it stops the dialog from closing. The parent can
  // return true from onCancel to consume the cancel — useful when an
  // internal pane should pop back instead of closing the whole dialog.
  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !onCancel) return
    const handleCancel = (event: Event) => {
      const consumed = onCancel()
      if (consumed) event.preventDefault()
    }
    dialog.addEventListener("cancel", handleCancel)
    return () => dialog.removeEventListener("cancel", handleCancel)
  }, [onCancel])

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={cn(
        // Reset UA dialog defaults: no margin auto, no padding, no border.
        // Background goes on the inner content wrapper instead so the
        // dialog itself can have its own backdrop without bleeding.
        "m-0 border-0 bg-transparent p-0",
        // Mobile: full-screen sheet. dvh tracks dynamic viewport, so the
        // dialog occupies whatever the layout viewport currently is.
        "h-[100dvh] max-h-[100dvh] w-full max-w-full",
        // Tablet+: centered modal with rounded corners and breathing room.
        "sm:m-auto sm:h-auto sm:max-h-[85dvh] sm:w-[32rem] sm:max-w-[calc(100%-2rem)] sm:rounded-2xl",
        // backdrop styling lives in index.css since ::backdrop is a
        // pseudo-element and Tailwind can't target it inline cleanly
        "native-dialog",
        className,
      )}
    >
      {/* Inner wrapper holds the actual visible chrome. Use bg-card (the
          elevated-surface color) rather than bg-background so the dialog
          reads as distinct above the dimmed backdrop in dark mode. */}
      <div className="flex h-full w-full flex-col bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-card-foreground sm:rounded-2xl sm:pt-0 sm:pb-0">
        {children}
      </div>
    </dialog>
  )
}
