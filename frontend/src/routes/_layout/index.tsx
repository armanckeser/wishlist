import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { UsersService } from "@/client"
import { wishlistSearchSchema } from "@/components/Wishlist"
import { clearAuthAndRedirect, isAuthError } from "@/utils"

// Extend base wishlist search schema with share target params
const searchSchema = wishlistSearchSchema.extend({
  share: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
})

export const Route = createFileRoute("/_layout/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Wishlist" }],
  }),
  loader: async ({ location }) => {
    try {
      // Fetch current user and redirect to their wishlist
      const user = await UsersService.readUserMe()
      const searchParams = new URLSearchParams(location.search)
      throw redirect({
        to: "/$userId",
        params: { userId: user.id },
        search: Object.fromEntries(searchParams.entries()),
      })
    } catch (error) {
      // Re-throw redirect (it's thrown, not returned)
      if (
        error instanceof Response ||
        (error as { isRedirect?: boolean })?.isRedirect
      ) {
        throw error
      }
      // Auth errors - clear token and redirect to login
      if (isAuthError(error)) {
        clearAuthAndRedirect("Your session has expired. Please log in again.")
        return // clearAuthAndRedirect handles the redirect
      }
      throw error
    }
  },
})
