import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Package } from "lucide-react"
import { Suspense, useState } from "react"

import { WishlistService } from "@/client"
import AddItem from "@/components/Items/AddItem"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DeleteItemDialog,
  EditItemDialog,
  FilterProvider,
  FilterSheet,
  getDefaultViewState,
  useFilter,
  type ViewState,
} from "@/components/Wishlist"
import { WishlistItem } from "@/components/WishlistItem"
import { WishlistToolbar } from "@/components/WishlistPage"
import { BudgetInfoProvider } from "@/contexts/BudgetInfoContext"
import { WishlistRoleProvider } from "@/contexts/WishlistRoleContext"
import useAuth from "@/hooks/useAuth"
import { useItemMutations } from "@/hooks/useItemMutations"
import { useWishlistDialogs } from "@/hooks/useWishlistDialogs"
import type { WishlistItemPublic } from "@/types"

export const Route = createFileRoute("/_layout/tracking")({
  component: TrackingPage,
  head: () => ({ meta: [{ title: "Tracking - Wishlist" }] }),
})

function trackingQueryOptions(userId: string) {
  return {
    queryFn: () =>
      WishlistService.readUserWishlist({ userId, skip: 0, limit: 100 }),
    queryKey: ["wishlist", "user", userId] as const,
  }
}

function TrackingPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <Suspense fallback={<TrackingPageSkeleton />}>
      <TrackingPageContent userId={user.id} />
    </Suspense>
  )
}

function TrackingPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Tracking</h1>
      </header>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="flex items-center gap-4 p-2">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TrackingPageContent({ userId }: { userId: string }) {
  const { data: wishlist } = useSuspenseQuery(trackingQueryOptions(userId))

  // Start with tracking defaults (items with tracking status + purchased/gifted with tracking)
  const [viewState, setViewState] = useState<ViewState>(() =>
    getDefaultViewState("tracking"),
  )

  return (
    <WishlistRoleProvider ownerId={userId} currentUserId={userId}>
      <BudgetInfoProvider>
        <FilterProvider
          items={wishlist.data}
          viewState={viewState}
          onViewStateChange={setViewState}
        >
          <TrackingLayout items={wishlist.data} userId={userId} />
        </FilterProvider>
      </BudgetInfoProvider>
    </WishlistRoleProvider>
  )
}

function TrackingLayout({
  items,
  userId,
}: {
  items: WishlistItemPublic[]
  userId: string
}) {
  const { filteredItems, filteredCount, activeFilterCount } = useFilter()
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const { editDialog, deleteDialog } = useWishlistDialogs()

  const selectedItem = selectedItemId
    ? (items.find((i) => i.id === selectedItemId) ?? null)
    : null

  const { archive, unarchive } = useItemMutations({
    userId,
    onSuccess: () => setSelectedItemId(null),
  })

  const handleArchiveToggle = (item: WishlistItemPublic) => {
    if (item.status === "archived") {
      unarchive(item.id)
    } else {
      archive(item.id)
    }
  }

  // Filter to items that have tracking numbers
  const trackingItems = filteredItems.filter(
    (item) => "tracking_number" in item && item.tracking_number,
  )

  return (
    <div className="flex flex-col gap-6 pb-24">
      <header className="flex items-center gap-3">
        <Package className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Tracking</h1>
        <span className="text-sm text-muted-foreground">
          {trackingItems.length}{" "}
          {trackingItems.length === 1 ? "package" : "packages"}
        </span>
      </header>

      {trackingItems.length === 0 ? (
        <EmptyTrackingState />
      ) : (
        <>
          <WishlistToolbar
            filteredCount={filteredCount}
            activeFilterCount={activeFilterCount}
            viewMode="list"
            onViewModeChange={() => {}}
            onOpenFilters={() => setFilterSheetOpen(true)}
            hideViewToggle
          />
          {/* List view with Row component */}
          <div className="space-y-1">
            {trackingItems.map((item) => (
              <WishlistItem.Row
                key={item.id}
                item={item}
                onClick={() => setSelectedItemId(item.id)}
              />
            ))}
          </div>
        </>
      )}

      <FilterSheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen} />

      <WishlistItem.ItemDrawer
        item={selectedItem}
        open={!!selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
        isOwner={true}
        onEdit={editDialog.openWith}
        onArchive={handleArchiveToggle}
        onDelete={deleteDialog.openWith}
      />

      <EditItemDialog
        item={editDialog.item}
        open={editDialog.open}
        onOpenChange={editDialog.onOpenChange}
      />
      <DeleteItemDialog
        item={deleteDialog.item}
        open={deleteDialog.open}
        onOpenChange={(open) => {
          deleteDialog.onOpenChange(open)
          if (!open && deleteDialog.item?.id === selectedItemId) {
            setSelectedItemId(null)
          }
        }}
      />

      {/* Add tracking FAB */}
      <div
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-50"
        data-testid="add-tracking-fab"
      >
        <AddItem trackingMode />
      </div>
    </div>
  )
}

function EmptyTrackingState() {
  return (
    <div
      data-testid="empty-tracking-state"
      className="flex min-h-[50svh] flex-col items-center justify-center gap-4"
    >
      <Package className="h-12 w-12 text-muted-foreground/50" />
      <div className="text-center">
        <p className="text-lg font-medium">No packages being tracked</p>
        <p className="text-sm text-muted-foreground">
          Add a tracking number to see your shipments here
        </p>
      </div>
    </div>
  )
}
