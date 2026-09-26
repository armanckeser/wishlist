import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { differenceInDays } from "date-fns"
import { Search } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useIntersectionObserver } from "usehooks-ts"
import { z } from "zod"
import type { CooloffSettingsPublic } from "@/client"
import { WishlistService } from "@/client"
import { BudgetDisplay } from "@/components/Budget"
import { GiftSendCelebration } from "@/components/Celebrations"
import { FloatingLayer } from "@/components/Common/FloatingLayer"
import AddItem from "@/components/Items/AddItem"
import {
  ArchiveFeedbackCard,
  MostDesiredSpotlight,
  PurchaseCelebration,
} from "@/components/MostDesired"
import { SelectionFAB } from "@/components/Selection"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DeleteItemDialog,
  EditItemDialog,
  FilterProvider,
  FilterSheet,
  parseSearchParams,
  useFilter,
  WishlistGrid,
  wishlistSearchSchema,
} from "@/components/Wishlist"
import { WishlistItem } from "@/components/WishlistItem"
import { Card } from "@/components/WishlistItem/presets/Card"
import { GroupedItemsList, WishlistToolbar } from "@/components/WishlistPage"
import { AddItemPrefillProvider } from "@/contexts/AddItemPrefillContext"
import { BudgetInfoProvider, useBudgetInfo } from "@/contexts/BudgetInfoContext"
import { useBudgetVisibility } from "@/contexts/BudgetVisibilityContext"
import {
  CooloffProvider,
  type CooloffSettings,
} from "@/contexts/CooloffContext"
import {
  MostDesiredProvider,
  useMostDesired,
} from "@/contexts/MostDesiredContext"
import { SelectionProvider } from "@/contexts/SelectionContext"
import { useCanDo, WishlistRoleProvider } from "@/contexts/WishlistRoleContext"
import useAuth from "@/hooks/useAuth"
import { useGiftMutation } from "@/hooks/useGiftMutation"
import { useItemMutations } from "@/hooks/useItemMutations"
import { useSelectionModeEffects } from "@/hooks/useSelectionModeEffects"
import { useShareTarget } from "@/hooks/useShareTarget"
import { useViewMode } from "@/hooks/useViewMode"
import { useWishlistDialogs } from "@/hooks/useWishlistDialogs"
import { useWishlistNavigation } from "@/hooks/useWishlistNavigation"
import type { WishlistItemPublic } from "@/types"

const searchSchema = wishlistSearchSchema.extend({
  share: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
})

export const Route = createFileRoute("/_layout/$userId")({
  component: WishlistPage,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Wishlist" }] }),
})

function userWishlistQueryOptions(userId: string) {
  return {
    queryFn: () =>
      WishlistService.readUserWishlist({ userId, skip: 0, limit: 100 }),
    queryKey: ["wishlist", "user", userId] as const,
  }
}

function WishlistSkeleton() {
  return (
    <WishlistGrid gap={16} minColumnWidth={160}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="space-y-3">
          <Skeleton className="aspect-[4/5] w-full rounded-sm" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </WishlistGrid>
  )
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8 pb-24">
      <section className="flex min-h-[80dvh] items-center justify-center">
        <Skeleton className="h-32 w-48" />
      </section>
      <section>
        <WishlistSkeleton />
      </section>
    </div>
  )
}

function WishlistPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WishlistPageContent />
    </Suspense>
  )
}

function toContextCooloffSettings(
  settings: CooloffSettingsPublic,
): CooloffSettings {
  return {
    cooloff_scaling_cents: settings.cooloff_scaling_cents,
    cooloff_scaling_days: settings.cooloff_scaling_days,
    cooloff_min_threshold_cents: settings.cooloff_min_threshold_cents,
    cooloff_min_threshold_days: settings.cooloff_min_threshold_days,
    cooloff_max_days: settings.cooloff_max_days,
    freeze_penalty_days: settings.freeze_penalty_days,
  }
}

/**
 * Main page content - fetches data and sets up providers.
 */
function WishlistPageContent() {
  const { userId } = Route.useParams()
  const searchParams = Route.useSearch({
    select: ({ item: _item, ...rest }) => rest,
  })
  const { user } = useAuth()

  const { data: wishlist } = useSuspenseQuery(userWishlistQueryOptions(userId))

  const currentUserId = user?.id ?? ""
  const isViewer = currentUserId !== userId
  const isOwner = currentUserId === userId
  const ownerCooloffSettings = isViewer
    ? toContextCooloffSettings(wishlist.owner_cooloff_settings)
    : undefined

  const viewState = parseSearchParams(searchParams)
  const { updateViewState } = useWishlistNavigation(viewState, { userId })

  const existingProductUrls = useMemo(
    () =>
      wishlist.data
        .map((item) => item.product_url)
        .filter((url): url is string => Boolean(url)),
    [wishlist.data],
  )

  const providers = (
    <WishlistRoleProvider ownerId={userId} currentUserId={currentUserId}>
      <BudgetInfoProvider>
        <MostDesiredProvider items={wishlist.data} userId={userId}>
          <SelectionProvider>
            <AddItemPrefillProvider
              existingUrls={existingProductUrls}
              enabled={isOwner}
              skip={Boolean(searchParams.share || searchParams.url)}
            >
              <FilterProvider
                items={wishlist.data}
                viewState={viewState}
                onViewStateChange={updateViewState}
              >
                <WishlistLayout
                  items={wishlist.data}
                  userId={userId}
                  shareParams={searchParams}
                />
              </FilterProvider>
            </AddItemPrefillProvider>
          </SelectionProvider>
        </MostDesiredProvider>
      </BudgetInfoProvider>
    </WishlistRoleProvider>
  )

  // Wrap with cooloff override when viewing someone else's wishlist
  if (ownerCooloffSettings) {
    return (
      <CooloffProvider overrideSettings={ownerCooloffSettings}>
        {providers}
      </CooloffProvider>
    )
  }

  return providers
}

function EmptyState() {
  const { isOwner } = useCanDo()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-display text-xl font-light text-foreground">
        {isOwner ? "Your wishlist is empty" : "This wishlist is empty"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner ? "Add items you're dreaming about" : "Check back later!"}
      </p>
    </div>
  )
}

/**
 * Most desired item spotlight section.
 * Only renders if there's a most desired item set.
 */
function MostDesiredSection({
  onItemClick,
}: {
  onItemClick: (itemId: string) => void
}) {
  const { mostDesiredItem } = useMostDesired()
  const { isOwner } = useCanDo()

  // Only show for owners with a most desired item
  if (!isOwner || !mostDesiredItem) {
    return null
  }

  return (
    <section className="px-1">
      <MostDesiredSpotlight onClick={() => onItemClick(mostDesiredItem.id)} />
    </section>
  )
}

/**
 * Main layout - renders UI. All state comes from context/hooks.
 */
function WishlistLayout({
  items,
  userId,
  shareParams,
}: {
  items: WishlistItemPublic[]
  userId: string
  shareParams: { share?: string; title?: string; text?: string; url?: string }
}) {
  const { setIsBudgetVisible } = useBudgetVisibility()
  const { isOwner, canAddItems } = useCanDo()
  const { groupedItems, filteredCount, activeFilterCount, viewState } =
    useFilter()
  // Navigation via hook
  const { selectItem, clearSelection } = useWishlistNavigation(viewState, {
    userId,
  })

  // URL-derived state
  const selectedItemId = Route.useSearch({ select: (s) => s.item })
  const selectedItem = selectedItemId
    ? (items.find((i) => i.id === selectedItemId) ?? null)
    : null

  // Local UI state
  const [viewMode, setViewMode] = useViewMode()
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const { editDialog, deleteDialog } = useWishlistDialogs()

  // Archive feedback state
  const [archiveFeedback, setArchiveFeedback] = useState<{
    open: boolean
    itemTitle: string
    itemPriceCents: number
  }>({ open: false, itemTitle: "", itemPriceCents: 0 })

  // Purchase celebration state (for ready-to-treat items)
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const [celebrationData, setCelebrationData] = useState<{
    item: WishlistItemPublic
    daysWaited: number
    isMostDesired: boolean
  } | null>(null)

  // Gift celebration state (for viewers gifting items)
  const [giftCelebrationTrigger, setGiftCelebrationTrigger] = useState(0)
  const [giftCelebrationData, setGiftCelebrationData] = useState<{
    item: WishlistItemPublic
    daysWaited: number
  } | null>(null)

  // Budget and most desired context
  const budgetInfo = useBudgetInfo()
  const { mostDesiredItem, getDaysSetback } = useMostDesired()

  // Share target (PWA) - clipboard prefill is handled via context in AddItem/ItemForm
  const shareTarget = useShareTarget(shareParams, viewState, selectedItemId)

  // Selection mode effects (drawer → exit, escape → exit)
  const { isSelectionMode } = useSelectionModeEffects({
    selectedItemId,
  })

  // Item mutations (owner actions)
  const { purchase, archive, unarchive } = useItemMutations({
    userId,
    onSuccess: clearSelection,
  })

  // Gift mutation (viewer action)
  const { gift } = useGiftMutation({
    ownerId: userId,
    onSuccess: clearSelection,
  })

  const handleArchiveToggle = (item: WishlistItemPublic) => {
    if (item.status === "archived") {
      unarchive(item.id)
    } else {
      archive(item.id)
      // Show feedback if most desired item exists
      if (mostDesiredItem && item.id !== mostDesiredItem.id) {
        setArchiveFeedback({
          open: true,
          itemTitle: item.title,
          itemPriceCents: item.price_cents,
        })
      }
    }
  }

  const handleBuy = (
    item: WishlistItemPublic,
    options?: {
      trackingUrl?: string
      actualPricePaidCents?: number
      silent?: boolean
    },
  ) => {
    // Check if item is ready-to-treat (affordable)
    const isAffordable =
      budgetInfo && budgetInfo.currentCents >= item.price_cents
    const isMostDesired = mostDesiredItem?.id === item.id

    // Trigger celebration for ready-to-treat items
    if (isAffordable) {
      const daysWaited = differenceInDays(new Date(), new Date(item.added_at))
      setCelebrationData({ item, daysWaited, isMostDesired })
      setCelebrationTrigger((prev) => prev + 1)
      // Silent purchase (no toast) when showing celebration
      purchase(item.id, {
        silent: true,
        trackingUrl: options?.trackingUrl,
        actualPricePaidCents: options?.actualPricePaidCents,
      })
    } else {
      // Normal purchase with toast
      purchase(item.id, {
        silent: options?.silent,
        trackingUrl: options?.trackingUrl,
        actualPricePaidCents: options?.actualPricePaidCents,
      })
    }
  }

  const handleCelebrationComplete = () => {
    setCelebrationData(null)
  }

  const handleGiftCelebrationComplete = () => {
    setGiftCelebrationData(null)
  }

  const handleGift = (
    item: WishlistItemPublic,
    options?: {
      giftMessage?: string
      gifterDisplayName?: string
      trackingUrl?: string
    },
  ) => {
    // Calculate days waited for celebration
    const daysWaited = differenceInDays(new Date(), new Date(item.added_at))
    setGiftCelebrationData({ item, daysWaited })
    setGiftCelebrationTrigger((prev) => prev + 1)

    // Gift the item (silent: true since we're showing celebration)
    gift(item.id, { ...options, silent: true })
  }

  // Budget visibility tracking
  const { isIntersecting, ref: tickerRef } = useIntersectionObserver({
    threshold: 0,
    rootMargin: "-64px 0px 0px 0px",
  })

  useEffect(() => {
    if (isOwner) setIsBudgetVisible(isIntersecting)
  }, [isIntersecting, setIsBudgetVisible, isOwner])

  return (
    <div className="flex flex-col gap-8 pb-24">
      {isOwner && (
        <section className="flex min-h-[80dvh] flex-col items-center justify-evenly">
          <BudgetDisplay tickerRef={tickerRef} />
          <MostDesiredSection onItemClick={(itemId) => selectItem(itemId)} />
        </section>
      )}
      {!isOwner && mostDesiredItem && (
        <section className="flex min-h-[40dvh] flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            {/* Title using display font (Cormorant Garamond) */}
            <h2 className="font-display text-2xl font-light tracking-tight text-foreground">
              Most Desired
            </h2>

            {/* Most desired item card - role automatically detected from context */}
            <div className="w-full max-w-sm">
              <Card
                item={mostDesiredItem}
                onClick={() => selectItem(mostDesiredItem.id)}
              />
            </div>
          </div>
        </section>
      )}
      {!isOwner && !mostDesiredItem && <div className="h-8" />}

      <section className="space-y-6">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <WishlistToolbar
              filteredCount={filteredCount}
              activeFilterCount={activeFilterCount}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onOpenFilters={() => setFilterSheetOpen(true)}
            />
            <GroupedItemsList
              groupedItems={groupedItems}
              viewMode={viewMode}
              onItemClick={(item) => selectItem(item.id)}
            />
          </>
        )}
      </section>

      <FilterSheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen} />

      <WishlistItem.ItemDrawer
        item={selectedItem}
        open={!!selectedItemId}
        onOpenChange={(open) => !open && clearSelection()}
        isOwner={isOwner}
        onEdit={editDialog.openWith}
        onArchive={handleArchiveToggle}
        onDelete={deleteDialog.openWith}
        onBuy={handleBuy}
        onGift={handleGift}
      />

      {isOwner && (
        <>
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
              if (!open && deleteDialog.item?.id === selectedItemId)
                clearSelection()
            }}
          />
          {mostDesiredItem && (
            <ArchiveFeedbackCard
              open={archiveFeedback.open}
              onOpenChange={(open) =>
                setArchiveFeedback((prev) => ({ ...prev, open }))
              }
              itemTitle={archiveFeedback.itemTitle}
              mostDesiredItemTitle={mostDesiredItem.title}
              daysSetback={getDaysSetback(archiveFeedback.itemPriceCents)}
            />
          )}
        </>
      )}

      {/* Purchase celebration (for ready-to-treat items) */}
      <PurchaseCelebration
        trigger={celebrationTrigger}
        onComplete={handleCelebrationComplete}
        itemTitle={celebrationData?.item.title}
        itemImageUrl={celebrationData?.item.image_url ?? undefined}
        daysWaited={celebrationData?.daysWaited}
        isMostDesired={celebrationData?.isMostDesired}
      />

      {/* Gift celebration (for viewers gifting items) */}
      <GiftSendCelebration
        trigger={giftCelebrationTrigger}
        onComplete={handleGiftCelebrationComplete}
        itemTitle={giftCelebrationData?.item.title}
        itemImageUrl={giftCelebrationData?.item.image_url ?? undefined}
        daysWaited={giftCelebrationData?.daysWaited}
      />

      {isSelectionMode ? (
        <SelectionFAB />
      ) : (
        canAddItems && (
          <FloatingLayer>
            <AddItem shareTargetUrl={shareTarget.url ?? undefined} />
          </FloatingLayer>
        )
      )}
    </div>
  )
}
