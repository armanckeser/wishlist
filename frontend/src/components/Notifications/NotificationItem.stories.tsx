import type { Meta, StoryObj } from "@storybook/react-vite"
import type { NotificationPublic } from "@/client"
import { NotificationItem } from "./NotificationItem"

const createMockNotification = (
  overrides: Partial<NotificationPublic> = {},
): NotificationPublic => ({
  id: "notification-1",
  user_id: "user-1",
  notification_type: "gift_received",
  title: "You received a gift!",
  message: "Someone bought an item from your wishlist as a gift.",
  created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  read_at: null,
  payload: null,
  ...overrides,
})

const meta: Meta<typeof NotificationItem> = {
  title: "Components/Notifications/NotificationItem",
  component: NotificationItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-md border bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    onMarkAsRead: () => {},
  },
}

export default meta
type Story = StoryObj<typeof NotificationItem>

/**
 * Unread notification with bold styling and indicator dot.
 */
export const Unread: Story = {
  args: {
    notification: createMockNotification(),
  },
}

/**
 * Read notification with muted styling.
 */
export const Read: Story = {
  args: {
    notification: createMockNotification({
      read_at: new Date().toISOString(),
    }),
  },
}

/**
 * Gift received notification type.
 */
export const GiftReceived: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "gift_received",
      title: "You received a gift!",
      message:
        "Troy Barnes bought the Gold Bracelet from your wishlist as a gift.",
    }),
  },
}

/**
 * Thank you notification type.
 */
export const ThankYou: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "thank_you",
      title: "Abed said thank you!",
      message: "Abed Nadir thanked you for the gift you sent.",
    }),
  },
}

/**
 * Freeze expiring notification type.
 */
export const FreezeExpiring: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "freeze_expiring",
      title: "Budget freeze ending soon",
      message: "Your budget freeze will end in 2 hours.",
    }),
  },
}

/**
 * Budget milestone notification type.
 */
export const BudgetMilestone: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "budget_milestone",
      title: "Budget milestone reached!",
      message: "Your budget has grown to $500. Great job saving!",
    }),
  },
}

/**
 * Notification with a long message that gets truncated.
 */
export const LongMessage: Story = {
  args: {
    notification: createMockNotification({
      title: "Important notification",
      message:
        "This is a very long notification message that should be truncated after two lines to ensure the UI remains clean and readable without taking up too much vertical space.",
    }),
  },
}

/**
 * Old notification showing relative time display.
 */
export const OldNotification: Story = {
  args: {
    notification: createMockNotification({
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    }),
  },
}

/**
 * Package delivered notification.
 */
export const PackageDelivered: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "delivery_delivered",
      title: "Package delivered!",
      message: "Your Pearl Necklace has been delivered.",
    }),
  },
}

/**
 * Package in transit notification.
 */
export const PackageInTransit: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "delivery_in_transit",
      title: "Package in transit",
      message: "Your Silk Scarf is on its way.",
    }),
  },
}

/**
 * Package out for delivery notification.
 */
export const PackageOutForDelivery: Story = {
  args: {
    notification: createMockNotification({
      notification_type: "delivery_out_for_delivery",
      title: "Out for delivery",
      message: "Your Gold Ring will arrive today.",
    }),
  },
}
