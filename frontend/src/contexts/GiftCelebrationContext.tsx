import { createContext, type ReactNode, useContext, useState } from "react"
import type { NotificationPublic } from "@/client"
import { GiftCelebration } from "@/components/Celebrations"

interface GiftNotificationPayload {
  item_id: string
  item_title: string
  gifter_id: string
  gifter_name: string
  gift_message?: string | null
  item_image_url?: string | null
}

interface GiftCelebrationContextValue {
  /** Show celebration for a gift notification. Marks notification as read on complete. */
  showGiftCelebration: (
    notification: NotificationPublic,
    markAsRead: (id: string) => void,
  ) => void
}

const GiftCelebrationContext =
  createContext<GiftCelebrationContextValue | null>(null)

interface GiftCelebrationProviderProps {
  children: ReactNode
}

export function GiftCelebrationProvider({
  children,
}: GiftCelebrationProviderProps) {
  const [trigger, setTrigger] = useState(0)
  const [celebrationData, setCelebrationData] = useState<{
    notification: NotificationPublic
    payload: GiftNotificationPayload
    markAsRead: (id: string) => void
  } | null>(null)

  const showGiftCelebration = (
    notification: NotificationPublic,
    markAsRead: (id: string) => void,
  ) => {
    const payload = notification.payload as unknown as GiftNotificationPayload
    setCelebrationData({ notification, payload, markAsRead })
    setTrigger((prev) => prev + 1)
  }

  const handleComplete = () => {
    if (celebrationData) {
      celebrationData.markAsRead(celebrationData.notification.id)
      setCelebrationData(null)
    }
  }

  return (
    <GiftCelebrationContext.Provider value={{ showGiftCelebration }}>
      {children}
      <GiftCelebration
        trigger={trigger}
        onComplete={handleComplete}
        itemTitle={celebrationData?.payload.item_title}
        itemImageUrl={celebrationData?.payload.item_image_url ?? undefined}
        gifterName={celebrationData?.payload.gifter_name}
        giftMessage={celebrationData?.payload.gift_message ?? undefined}
      />
    </GiftCelebrationContext.Provider>
  )
}

export function useGiftCelebration(): GiftCelebrationContextValue {
  const context = useContext(GiftCelebrationContext)
  if (!context) {
    throw new Error(
      "useGiftCelebration must be used within a GiftCelebrationProvider",
    )
  }
  return context
}
