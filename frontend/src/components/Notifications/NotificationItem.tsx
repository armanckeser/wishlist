import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  Clock,
  Gift,
  Heart,
  Info,
  PackageCheck,
  PauseCircle,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react"

import type { NotificationPublic, NotificationType } from "@/client"
import { cn } from "@/lib/utils"

interface NotificationItemProps {
  notification: NotificationPublic
  onMarkAsRead?: (id: string) => void
  /** Custom click handler - if provided, called instead of default mark-as-read */
  onClick?: (notification: NotificationPublic) => void
}

const notificationIcons: Record<NotificationType, React.ElementType> = {
  gift_received: Gift,
  thank_you: Heart,
  freeze_expiring: Snowflake,
  budget_milestone: TrendingUp,
  delivery_info_received: Info,
  delivery_in_transit: Truck,
  delivery_out_for_delivery: Truck,
  delivery_delivered: PackageCheck,
  delivery_exception: AlertTriangle,
  delivery_expired: Clock,
  price_drop: TrendingDown,
  price_increase: TrendingUp,
  price_tracking_paused: PauseCircle,
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
}: NotificationItemProps) {
  const isUnread = notification.read_at === null
  const Icon = notificationIcons[notification.notification_type]
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  })

  const handleClick = () => {
    // If custom onClick is provided, use it
    if (onClick) {
      onClick(notification)
      return
    }

    // Default: mark as read if unread
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-muted/50",
        isUnread && "bg-muted/30",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUnread
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <p
          className={cn(
            "text-sm leading-tight",
            isUnread ? "font-medium" : "text-muted-foreground",
          )}
        >
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground/60">{timeAgo}</p>
      </div>
      {isUnread && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  )
}
