/**
 * ShareSettings - Component for managing wishlist sharing settings.
 *
 * Manages:
 * - Wishlist URL display with copy button
 * - Visibility toggle (private/public)
 * - List of users the wishlist is shared with
 * - Form to share with new users
 * - List of wishlists shared with current user
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Check, Copy, ExternalLink, Globe, Lock, Users, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import type { WishlistSharePublic, WishlistVisibility } from "@/client"
import { SharesService, UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const shareFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type ShareFormData = z.infer<typeof shareFormSchema>

function ShareSettings() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const form = useForm<ShareFormData>({
    resolver: zodResolver(shareFormSchema),
    defaultValues: { email: "" },
  })

  const { data: myShares, isLoading: isLoadingMyShares } = useQuery({
    queryKey: ["shares", "mine"],
    queryFn: () => SharesService.readMyShares(),
  })

  const { data: sharesWithMe, isLoading: isLoadingSharesWithMe } = useQuery({
    queryKey: ["shares", "with-me"],
    queryFn: () => SharesService.readSharesWithMe(),
  })

  const createShareMutation = useMutation({
    mutationFn: (email: string) =>
      SharesService.createNewShare({
        requestBody: { shared_with_email: email },
      }),
    onSuccess: () => {
      showSuccessToast("Wishlist shared successfully")
      form.reset()
      queryClient.invalidateQueries({ queryKey: ["shares", "mine"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteShareMutation = useMutation({
    mutationFn: (shareId: string) =>
      SharesService.deleteShareEndpoint({ shareId }),
    onSuccess: () => {
      showSuccessToast("Share revoked")
      queryClient.invalidateQueries({ queryKey: ["shares", "mine"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateVisibilityMutation = useMutation({
    mutationFn: (visibility: WishlistVisibility) =>
      UsersService.updateUserMe({
        requestBody: { wishlist_visibility: visibility },
      }),
    onSuccess: () => {
      showSuccessToast("Visibility updated")
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const wishlistUrl = user ? `${window.location.origin}/${user.id}` : ""

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wishlistUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = (data: ShareFormData) => {
    createShareMutation.mutate(data.email)
  }

  if (!user) {
    return null
  }

  const isLoading = isLoadingMyShares || isLoadingSharesWithMe

  if (isLoading) {
    return (
      <div className="max-w-md animate-pulse space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const hasRecipients = (myShares?.data.length ?? 0) > 0
  const isPublic = user.wishlist_visibility === "public"
  const showShareLink = isPublic || hasRecipients

  return (
    <div className="max-w-md space-y-8">
      <h3 className="text-lg font-semibold">Sharing Settings</h3>

      {/* Shared With Section - First, so users choose recipients before seeing the link */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">
            Share With Specific People
          </span>
        </div>

        {myShares?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add people below to share your wishlist with them directly.
          </p>
        ) : (
          <ul className="space-y-2">
            {myShares?.data.map((share) => (
              <ShareListItem
                key={share.id}
                share={share}
                onRevoke={() => deleteShareMutation.mutate(share.id)}
                isPending={deleteShareMutation.isPending}
              />
            ))}
          </ul>
        )}

        {/* Add person form */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex gap-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="send"
                      placeholder="Enter email to share with..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={createShareMutation.isPending}
              className="shrink-0"
            >
              Share
            </Button>
          </form>
        </Form>
      </section>

      <Separator />

      {/* Visibility Section */}
      <section className="space-y-3">
        <p className="text-sm font-medium">Wishlist Visibility</p>
        <Select
          value={user.wishlist_visibility}
          onValueChange={(value: WishlistVisibility) =>
            updateVisibilityMutation.mutate(value)
          }
          disabled={updateVisibilityMutation.isPending}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Private - Only people you share with</span>
              </div>
            </SelectItem>
            <SelectItem value="public">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Public - Anyone with the link</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {!showShareLink && (
          <p className="text-xs text-muted-foreground">
            Add people above or set visibility to public to get a shareable
            link.
          </p>
        )}
      </section>

      {/* Wishlist URL Section - Only shown when public or has recipients */}
      {showShareLink && (
        <>
          <Separator />
          <section className="space-y-3">
            <p className="text-sm font-medium">Your Wishlist URL</p>
            <div className="flex gap-2">
              <Input
                value={wishlistUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </section>
        </>
      )}

      <Separator />

      {/* Wishlists Shared With Me Section */}
      <section className="space-y-3">
        <p className="text-sm font-medium">Wishlists Shared With You</p>

        {sharesWithMe?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has shared their wishlist with you yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {sharesWithMe?.data.map((share) => (
              <SharedWithMeItem key={share.id} share={share} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ShareListItem({
  share,
  onRevoke,
  isPending,
}: {
  share: WishlistSharePublic
  onRevoke: () => void
  isPending: boolean
}) {
  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm">{share.shared_with_email}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRevoke}
        disabled={isPending}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  )
}

function SharedWithMeItem({ share }: { share: WishlistSharePublic }) {
  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm">{share.owner_email}</span>
      <Link to="/$userId" params={{ userId: share.owner_id }}>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </Link>
    </li>
  )
}

export default ShareSettings
