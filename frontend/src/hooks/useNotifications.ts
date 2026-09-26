import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { NotificationsService } from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

/**
 * Hook for managing notifications.
 * Provides notifications data, unread count, and actions to mark as read.
 */
export function useNotifications() {
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => NotificationsService.listNotifications({ limit: 50 }),
    refetchInterval: 30000,
  })

  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => NotificationsService.readUnreadCount(),
    refetchInterval: 30000,
  })

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      NotificationsService.markNotificationRead({ notificationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => NotificationsService.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return {
    notifications: notificationsQuery.data?.data ?? [],
    unreadCount: unreadCountQuery.data?.count ?? 0,
    isLoading: notificationsQuery.isLoading,
    markAsRead: (notificationId: string) =>
      markAsReadMutation.mutate(notificationId),
    markAllRead: () => markAllReadMutation.mutate(),
    isMarkingRead: markAsReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
  }
}
