import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { PushService, type PushSubscriptionCreate } from "@/client"
import useCustomToast from "./useCustomToast"

type Permission = "prompt" | "granted" | "denied" | "unsupported"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Hook for managing push notifications.
 * Handles service worker registration, permission requests, and subscription management.
 */
export function usePushNotifications() {
  const queryClient = useQueryClient()
  const { showErrorToast, showSuccessToast } = useCustomToast()
  const [permission, setPermission] = useState<Permission>("unsupported")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)

  const isSupported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window

  const vapidKeyQuery = useQuery({
    queryKey: ["push", "vapid-key"],
    queryFn: () => PushService.getVapidKey(),
    enabled: isSupported,
    staleTime: Infinity,
  })

  // Check current permission and subscription status
  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported")
      setIsCheckingSubscription(false)
      return
    }

    setPermission(Notification.permission as Permission)

    // Check if already subscribed (only if service worker is already registered)
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (registration) {
          return registration.pushManager.getSubscription()
        }
        return null
      })
      .then((subscription) => {
        setIsSubscribed(!!subscription)
        setIsCheckingSubscription(false)
      })
      .catch(() => {
        setIsCheckingSubscription(false)
      })
  }, [isSupported])

  const subscribeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const vapidKey = vapidKeyQuery.data?.public_key
      if (!vapidKey) {
        throw new Error("Push notifications not enabled on server")
      }

      // Request notification permission
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult as Permission)

      if (permissionResult !== "granted") {
        throw new Error("Notification permission denied")
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })

      // Extract keys
      const subscriptionJson = subscription.toJSON()
      if (!subscriptionJson.keys?.p256dh || !subscriptionJson.keys?.auth) {
        throw new Error("Failed to get subscription keys")
      }

      const subscriptionData: PushSubscriptionCreate = {
        endpoint: subscription.endpoint,
        p256dh_key: subscriptionJson.keys.p256dh,
        auth_key: subscriptionJson.keys.auth,
      }

      // Send to backend
      await PushService.subscribeToPush({ requestBody: subscriptionData })
    },
    onSuccess: () => {
      setIsSubscribed(true)
      showSuccessToast("Push notifications enabled")
      queryClient.invalidateQueries({ queryKey: ["push"] })
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        showErrorToast(error.message)
      } else {
        showErrorToast("Failed to enable push notifications")
      }
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe()

        // Remove from backend
        await PushService.unsubscribeFromPush({
          endpoint: subscription.endpoint,
        })
      }
    },
    onSuccess: () => {
      setIsSubscribed(false)
      showSuccessToast("Push notifications disabled")
      queryClient.invalidateQueries({ queryKey: ["push"] })
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        showErrorToast(error.message)
      } else {
        showErrorToast("Failed to disable push notifications")
      }
    },
  })

  const subscribe = useCallback(() => {
    subscribeMutation.mutate()
  }, [subscribeMutation])

  const unsubscribe = useCallback(() => {
    unsubscribeMutation.mutate()
  }, [unsubscribeMutation])

  return {
    isSupported,
    isEnabled: vapidKeyQuery.data?.enabled ?? false,
    permission,
    isSubscribed,
    isLoading:
      isCheckingSubscription ||
      vapidKeyQuery.isLoading ||
      subscribeMutation.isPending ||
      unsubscribeMutation.isPending,
    subscribe,
    unsubscribe,
  }
}
