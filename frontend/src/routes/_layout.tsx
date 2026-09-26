import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { BudgetTicker } from "@/components/Budget"
import { IOSInstallCoach } from "@/components/Common/IOSInstallCoach"
import { Logo } from "@/components/Common/Logo"
import { MobileNav } from "@/components/Common/MobileNav"
import { WhatsNewDrawer } from "@/components/Common/WhatsNewDrawer"
import { NotificationBell } from "@/components/Notifications"
import {
  BudgetVisibilityProvider,
  useBudgetVisibility,
} from "@/contexts/BudgetVisibilityContext"
import { CooloffProvider } from "@/contexts/CooloffContext"
import {
  GiftCelebrationProvider,
  useGiftCelebration,
} from "@/contexts/GiftCelebrationContext"
import { RecentCategoriesProvider } from "@/contexts/RecentCategoriesContext"
import { isLoggedIn } from "@/hooks/useAuth"
import { useNotifications } from "@/hooks/useNotifications"
import { useWhatsNew } from "@/hooks/useWhatsNew"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  return (
    <CooloffProvider>
      <BudgetVisibilityProvider>
        <RecentCategoriesProvider>
          <GiftCelebrationProvider>
            <LayoutContent />
          </GiftCelebrationProvider>
        </RecentCategoriesProvider>
      </BudgetVisibilityProvider>
    </CooloffProvider>
  )
}

function LayoutContent() {
  const { isBudgetVisible } = useBudgetVisibility()
  const whatsNew = useWhatsNew()
  const { notifications, markAsRead, isLoading } = useNotifications()
  const { showGiftCelebration } = useGiftCelebration()

  const hasCheckedGiftNotification = useRef(false)

  // Check for unread gift notifications on mount and show celebration
  useEffect(() => {
    if (isLoading || hasCheckedGiftNotification.current) return

    const unreadGiftNotification = notifications.find(
      (n) => n.notification_type === "gift_received" && n.read_at === null,
    )

    if (unreadGiftNotification) {
      hasCheckedGiftNotification.current = true
      showGiftCelebration(unreadGiftNotification, markAsRead)
    }
  }, [notifications, isLoading, showGiftCelebration, markAsRead])

  return (
    <>
      {/* Shell chrome. The header is a plain flex child of #root rather than
          position:sticky — the document no longer scrolls, so it is pinned by
          the shell layout itself and never participates in a scroll. */}
      <header
        className="relative z-10 flex min-h-16 shrink-0 items-center justify-between border-b bg-background px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <MobileNav onWhatsNewClick={whatsNew.open} />
        <div className="absolute left-1/2 -translate-x-1/2">
          {isBudgetVisible ? (
            <Logo variant="full" />
          ) : (
            <BudgetTicker
              size="sm"
              className="animate-in fade-in duration-200"
            />
          )}
        </div>
        <NotificationBell />
      </header>
      {/* The app's single scroll region. data-app-scroll carries the flex /
          overflow rules (see index.css) and is what modals lock instead of
          the body. */}
      <main data-app-scroll className="p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <WhatsNewDrawer
        open={whatsNew.isOpen}
        content={whatsNew.content}
        version={whatsNew.version}
        onDismiss={whatsNew.dismiss}
      />

      <IOSInstallCoach />
    </>
  )
}

export default Layout
