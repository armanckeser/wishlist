import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DrawerClose } from "@/components/ui/drawer"

/**
 * Close button for drawer header.
 */
export function CloseButton() {
  return (
    <DrawerClose asChild>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </DrawerClose>
  )
}
