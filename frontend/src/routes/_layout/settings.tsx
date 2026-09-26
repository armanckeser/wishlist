import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

import BudgetSettings from "@/components/UserSettings/BudgetSettings"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import NotificationSettings from "@/components/UserSettings/NotificationSettings"
import UserInformation from "@/components/UserSettings/UserInformation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "budget", title: "Budget", component: BudgetSettings },
  {
    value: "notifications",
    title: "Notifications",
    component: NotificationSettings,
  },
  { value: "my-profile", title: "My profile", component: UserInformation },
  { value: "password", title: "Password", component: ChangePassword },
  { value: "danger-zone", title: "Danger zone", component: DeleteAccount },
] as const

type TabValue = (typeof tabsConfig)[number]["value"]

const tabValues = tabsConfig.map((t) => t.value) as unknown as readonly [
  TabValue,
  ...TabValue[],
]

const searchSchema = z.object({
  tab: z.enum(tabValues).optional().default("budget"),
})

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      {
        title: "Settings - Wishlist",
      },
    ],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()

  // Superusers don't see "Danger zone" tab
  const finalTabs = currentUser?.is_superuser
    ? tabsConfig.slice(0, 3)
    : tabsConfig

  const handleTabChange = (value: string) => {
    navigate({
      to: "/settings",
      search: { tab: value as TabValue },
      replace: true,
    })
  }

  if (!currentUser) {
    return null
  }

  // Find the active tab configuration
  const activeTab = finalTabs.find((t) => t.value === tab) ?? finalTabs[0]
  const ActiveComponent = activeTab.component

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Select value={tab} onValueChange={handleTabChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Select section" />
        </SelectTrigger>
        <SelectContent>
          {finalTabs.map((tabItem) => (
            <SelectItem key={tabItem.value} value={tabItem.value}>
              {tabItem.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-2">
        <ActiveComponent />
      </div>
    </div>
  )
}
