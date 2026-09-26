interface GroupHeaderProps {
  label: string
  itemCount: number
}

/**
 * Section header for a group of wishlist items.
 */
export function GroupHeader({ label, itemCount }: GroupHeaderProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </h2>
      <p className="text-xs text-muted-foreground/70">
        {itemCount} item{itemCount !== 1 && "s"}
      </p>
    </div>
  )
}
