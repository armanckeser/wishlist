import { createContext, type ReactNode, useContext, useMemo } from "react"

/**
 * Role determines what a user can do with a wishlist.
 * - owner: Full access (edit, purchase, delete, share)
 * - viewer: Read-only access (can see items but not modify)
 */
export type WishlistRole = "owner" | "viewer"

/**
 * Permission lookup - derive capabilities from role.
 * Using records instead of booleans for type-safe exhaustive checks.
 */
export const CAN_EDIT: Record<WishlistRole, boolean> = {
  owner: true,
  viewer: false,
}

export const CAN_PURCHASE: Record<WishlistRole, boolean> = {
  owner: true,
  viewer: false,
}

export const CAN_DELETE: Record<WishlistRole, boolean> = {
  owner: true,
  viewer: false,
}

export const CAN_ADD_ITEMS: Record<WishlistRole, boolean> = {
  owner: true,
  viewer: false,
}

interface WishlistRoleContextValue {
  /** Current user's role for this wishlist */
  role: WishlistRole
  /** ID of the wishlist owner */
  ownerId: string
}

const WishlistRoleContext = createContext<WishlistRoleContextValue | undefined>(
  undefined,
)

interface WishlistRoleProviderProps {
  children: ReactNode
  /** ID of the wishlist owner */
  ownerId: string
  /** Current user's ID (from auth) */
  currentUserId: string
}

export function WishlistRoleProvider({
  children,
  ownerId,
  currentUserId,
}: WishlistRoleProviderProps) {
  const value = useMemo(() => {
    const role: WishlistRole = currentUserId === ownerId ? "owner" : "viewer"
    return { role, ownerId }
  }, [ownerId, currentUserId])

  return (
    <WishlistRoleContext.Provider value={value}>
      {children}
    </WishlistRoleContext.Provider>
  )
}

export function useWishlistRole(): WishlistRoleContextValue {
  const context = useContext(WishlistRoleContext)
  if (!context) {
    throw new Error(
      "useWishlistRole must be used within a WishlistRoleProvider",
    )
  }
  return context
}

/**
 * Hook to check if current user can perform an action.
 * Returns a function that takes a role and returns permission.
 */
export function useCanDo() {
  const { role } = useWishlistRole()
  return {
    canEdit: CAN_EDIT[role],
    canPurchase: CAN_PURCHASE[role],
    canDelete: CAN_DELETE[role],
    canAddItems: CAN_ADD_ITEMS[role],
    isOwner: role === "owner",
  }
}
