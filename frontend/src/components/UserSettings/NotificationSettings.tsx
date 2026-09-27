import { AlertCircle, Bell, BellOff } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LoadingButton } from "@/components/ui/loading-button"
import { usePushNotifications } from "@/hooks/usePushNotifications"

const NotificationSettings = () => {
  const {
    isSupported,
    isEnabled,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications()

  if (!isSupported) {
    return (
      <div className="max-w-md">
        <h3 className="text-lg font-semibold py-4">Push Notifications</h3>
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not supported</AlertTitle>
          <AlertDescription>
            Push notifications are not supported in this browser.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isEnabled) {
    return (
      <div className="max-w-md">
        <h3 className="text-lg font-semibold py-4">Push Notifications</h3>
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not available</AlertTitle>
          <AlertDescription>
            Push notifications are not enabled on the server.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (permission === "denied") {
    return (
      <div className="max-w-md">
        <h3 className="text-lg font-semibold py-4">Push Notifications</h3>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Permission denied</AlertTitle>
          <AlertDescription>
            Allow notifications for this site in your browser settings.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <h3 className="text-lg font-semibold py-4">Push Notifications</h3>
      <p className="text-muted-foreground mb-4">
        Gifts, freezes ending and budget milestones.
      </p>

      {isSubscribed ? (
        <div className="flex flex-col gap-4">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>Notifications enabled</AlertTitle>
            <AlertDescription>
              You will receive push notifications on this device.
            </AlertDescription>
          </Alert>
          <LoadingButton
            variant="outline"
            onClick={unsubscribe}
            loading={isLoading}
            className="w-fit"
          >
            <BellOff className="mr-2 h-4 w-4" />
            Disable notifications
          </LoadingButton>
        </div>
      ) : (
        <LoadingButton
          onClick={subscribe}
          loading={isLoading}
          className="w-fit"
        >
          <Bell className="mr-2 h-4 w-4" />
          Enable push notifications
        </LoadingButton>
      )}
    </div>
  )
}

export default NotificationSettings
