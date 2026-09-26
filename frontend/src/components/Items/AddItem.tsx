import { Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useAddItemPrefillOptional } from "@/contexts/AddItemPrefillContext"

import { ItemDialog } from "./ItemDialog"

interface AddItemProps {
  /** Optional custom trigger element. If not provided, uses default FAB button. */
  trigger?: React.ReactNode
  /** Controlled open state (optional) */
  open?: boolean
  /** Controlled open change handler (optional) */
  onOpenChange?: (open: boolean) => void
  /** Initial product URL for share target (route params) */
  shareTargetUrl?: string
  /** Enable tracking mode - for adding tracked packages */
  trackingMode?: boolean
}

export type { AddItemProps }

const AddItem = ({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  shareTargetUrl,
  trackingMode = false,
}: AddItemProps = {}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const prefillContext = useAddItemPrefillOptional()

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen

  // The FAB click is a fresh user gesture — the iOS-required precondition
  // for navigator.clipboard.readText(). Fire the read inside the gesture
  // (no awaits before it inside checkClipboard) so iOS shows the system
  // "Allow Paste" prompt in context, then auto-fills the URL.
  const handleTriggerClick = () => {
    if (prefillContext && prefillContext.state === "idle") {
      void prefillContext.checkClipboard()
    }
    setIsOpen(true)
  }

  const defaultTrigger = (
    <Button
      size="lg"
      className="relative h-14 w-14 rounded-lg shadow-lg transition-shadow hover:shadow-xl"
      onClick={handleTriggerClick}
    >
      <Plus className="h-6 w-6" strokeWidth={1.5} />
      <span className="sr-only">Add item</span>
    </Button>
  )

  return (
    <>
      {trigger ?? defaultTrigger}
      <ItemDialog
        mode="add"
        open={isOpen}
        onOpenChange={setIsOpen}
        shareTargetUrl={shareTargetUrl}
        trackingMode={trackingMode}
      />
    </>
  )
}

export default AddItem
