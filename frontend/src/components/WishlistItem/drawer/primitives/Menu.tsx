import {
  Archive,
  ArchiveRestore,
  Clock,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMostDesiredOptional } from "@/contexts/MostDesiredContext"

import { useWishlistItem } from "../../context"
import { WaiveCooldownDialog } from "../../drawer/actions/WaiveCooldownDialog"

/**
 * Options menu for drawer header.
 * Only renders if onEdit, onArchive, or onDelete actions are provided.
 */
export function Menu() {
  const { item, actions, isArchived, isPurchased, maturity } = useWishlistItem()
  const { onEdit, onArchive, onDelete } = actions
  const mostDesired = useMostDesiredOptional()
  const [waiveCooldownOpen, setWaiveCooldownOpen] = useState(false)

  // Can toggle most desired if context is available and item is not purchased/archived
  const canToggleMostDesired =
    mostDesired && !isPurchased && !isArchived && item.status === "wishlisted"

  // Can waive cooldown if item is in cooling or growing state
  const canWaiveCooldown =
    item.status === "wishlisted" &&
    (maturity.state === "cooling" || maturity.state === "growing")

  // Don't render if no actions available
  if (
    !onEdit &&
    !onArchive &&
    !onDelete &&
    !canToggleMostDesired &&
    !canWaiveCooldown
  ) {
    return null
  }

  const handleToggleMostDesired = () => {
    mostDesired?.toggleMostDesired(item.id)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Item options"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canToggleMostDesired && (
            <DropdownMenuItem
              onClick={handleToggleMostDesired}
              disabled={mostDesired.isToggling}
            >
              <Star
                className={
                  item.is_most_desired
                    ? "mr-2 h-4 w-4 fill-amber-500 text-amber-500"
                    : "mr-2 h-4 w-4"
                }
              />
              {item.is_most_desired
                ? "Remove from most desired"
                : "Set as most desired"}
            </DropdownMenuItem>
          )}
          {canWaiveCooldown && (
            <DropdownMenuItem onClick={() => setWaiveCooldownOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Waive cooldown
            </DropdownMenuItem>
          )}
          {(canToggleMostDesired || canWaiveCooldown) &&
            (onEdit || onArchive || onDelete) && <DropdownMenuSeparator />}
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(item)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit item
            </DropdownMenuItem>
          )}
          {onArchive && (
            <DropdownMenuItem onClick={() => onArchive(item)}>
              {isArchived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive item
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive item
                </>
              )}
            </DropdownMenuItem>
          )}
          {(onEdit || onArchive) && onDelete && <DropdownMenuSeparator />}
          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete item
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canWaiveCooldown && (
        <WaiveCooldownDialog
          open={waiveCooldownOpen}
          onOpenChange={setWaiveCooldownOpen}
        />
      )}
    </>
  )
}
