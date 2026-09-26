import { createFileRoute } from "@tanstack/react-router"

import ShareSettings from "@/components/UserSettings/ShareSettings"

export const Route = createFileRoute("/_layout/sharing")({
  component: Sharing,
  head: () => ({
    meta: [
      {
        title: "Sharing - Wishlist",
      },
    ],
  }),
})

function Sharing() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sharing</h1>
        <p className="text-muted-foreground">
          Manage who can see your wishlist
        </p>
      </div>
      <ShareSettings />
    </div>
  )
}
