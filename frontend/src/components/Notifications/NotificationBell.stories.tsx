import type { Meta, StoryObj } from "@storybook/react-vite"
import type { NotificationPublic } from "@/client"
import { NotificationBellContent } from "./NotificationBell"

const createMockNotification = (
  id: string,
  overrides: Partial<NotificationPublic> = {},
): NotificationPublic => ({
  id,
  user_id: "user-1",
  notification_type: "gift_received",
  title: "You received a gift!",
  message: "Someone bought an item from your wishlist as a gift.",
  created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  read_at: null,
  payload: null,
  ...overrides,
})

const mockNotifications: NotificationPublic[] = [
  createMockNotification("1", {
    notification_type: "gift_received",
    title: "You received a gift!",
    message: "Troy Barnes bought the Gold Bracelet from your wishlist.",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  }),
  createMockNotification("2", {
    notification_type: "budget_milestone",
    title: "Budget milestone reached!",
    message: "Your budget has grown to $500. Great job saving!",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  }),
  createMockNotification("3", {
    notification_type: "freeze_expiring",
    title: "Budget freeze ending soon",
    message: "Your budget freeze will end in 2 hours.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  }),
  createMockNotification("4", {
    notification_type: "thank_you",
    title: "Abed said thank you!",
    message: "Abed Nadir thanked you for the gift you sent.",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  }),
]

const meta: Meta<typeof NotificationBellContent> = {
  title: "Components/Notifications/NotificationBell",
  component: NotificationBellContent,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onMarkAsRead: () => {},
    onMarkAllRead: () => {},
    isLoading: false,
    isMarkingAllRead: false,
  },
}

export default meta
type Story = StoryObj<typeof NotificationBellContent>

/**
 * Empty state with no notifications.
 * Shows bell icon without badge and empty state in dropdown.
 */
export const NoNotifications: Story = {
  args: {
    notifications: [],
    unreadCount: 0,
  },
}

/**
 * Bell with unread notifications badge.
 * Dropdown shows mix of read and unread items.
 */
export const WithUnread: Story = {
  args: {
    notifications: mockNotifications,
    unreadCount: 2,
  },
}

/**
 * All notifications have been read.
 * No badge on bell, items show muted styling.
 */
export const AllRead: Story = {
  args: {
    notifications: mockNotifications.map((n) => ({
      ...n,
      read_at: new Date().toISOString(),
    })),
    unreadCount: 0,
  },
}

/**
 * Loading state while fetching notifications.
 */
export const Loading: Story = {
  args: {
    notifications: [],
    unreadCount: 0,
    isLoading: true,
  },
}

/**
 * Bell with many unread notifications.
 * Badge shows truncated count (99+).
 */
export const ManyUnread: Story = {
  args: {
    notifications: mockNotifications,
    unreadCount: 127,
  },
}

/**
 * Single unread notification.
 */
export const SingleUnread: Story = {
  args: {
    notifications: [mockNotifications[0]],
    unreadCount: 1,
  },
}
