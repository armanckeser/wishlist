import { Bell, Check } from "lucide-react"
import { useState } from "react"

import type { NotificationPublic } from "@/client"
import { GiftCelebration } from "@/components/Celebrations"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotifications } from "@/hooks/useNotifications"
import { NotificationItem } from "./NotificationItem"

interface GiftNotificationPayload {
  item_id: string
  item_title: string
  gifter_id: string
  gifter_name: string
  gift_message?: string | null
  item_image_url?: string | null
}

export interface NotificationBellContentProps {
  notifications: NotificationPublic[]
  unreadCount: number
  isLoading?: boolean
  isMarkingAllRead?: boolean
  onMarkAsRead?: (id: string) => void
  onMarkAllRead?: () => void
  /** Custom click handler for notifications */
  onNotificationClick?: (notification: NotificationPublic) => void
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}

/**
 * Presentational component for notification bell dropdown.
 * Use NotificationBell for the connected version with data fetching.
 */
export function NotificationBellContent({
  notifications,
  unreadCount,
  isLoading = false,
  isMarkingAllRead = false,
  onMarkAsRead,
  onMarkAllRead,
  onNotificationClick,
  open,
  onOpenChange,
}: NotificationBellContentProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              disabled={isMarkingAllRead}
              className="h-auto px-2 py-1 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">
                No notifications yet
              </span>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={onMarkAsRead}
                  onClick={onNotificationClick}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Connected notification bell that fetches data via useNotifications hook.
 * Handles gift notification clicks by showing celebration.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const [giftPayload, setGiftPayload] =
    useState<GiftNotificationPayload | null>(null)

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications()

  const handleNotificationClick = (notification: NotificationPublic) => {
    const isUnread = notification.read_at === null

    // Handle gift notifications - show celebration
    if (notification.notification_type === "gift_received") {
      const payload = notification.payload as unknown as GiftNotificationPayload
      setGiftPayload(payload)
      setOpen(false) // Close popover first

      // Delay celebration to allow popover to close
      setTimeout(() => {
        setCelebrationTrigger((prev) => prev + 1)
        if (isUnread) {
          markAsRead(notification.id)
        }
      }, 150)
      return
    }

    // Default: mark as read
    if (isUnread) {
      markAsRead(notification.id)
    }
  }

  return (
    <>
      <NotificationBellContent
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={isLoading}
        isMarkingAllRead={isMarkingAllRead}
        onMarkAsRead={markAsRead}
        onMarkAllRead={markAllRead}
        onNotificationClick={handleNotificationClick}
        open={open}
        onOpenChange={setOpen}
      />

      {giftPayload && (
        <GiftCelebration
          trigger={celebrationTrigger}
          itemTitle={giftPayload.item_title}
          itemImageUrl={giftPayload.item_image_url ?? undefined}
          gifterName={giftPayload.gifter_name}
          giftMessage={giftPayload.gift_message ?? undefined}
        />
      )}
    </>
  )
}
