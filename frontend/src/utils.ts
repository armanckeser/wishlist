import { AxiosError } from "axios"
import { ApiError } from "./client"

function extractErrorMessage(err: ApiError): string {
  if (err instanceof AxiosError) {
    return err.message
  }

  const errDetail = (err.body as any)?.detail
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    return errDetail[0].msg
  }
  return errDetail || "Something went wrong."
}

export const handleError = function (
  this: (msg: string) => void,
  err: ApiError,
) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

/**
 * Check if error is an auth failure requiring re-login.
 *
 * Only 401 means authentication failure.
 * 403 means valid auth but insufficient permissions (NOT an auth failure).
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }

  // Only 401 Unauthorized means auth failure
  return error.status === 401
}

/**
 * Clear authentication state and redirect to login.
 * Centralized function ensures consistent behavior.
 */
export function clearAuthAndRedirect(message?: string): void {
  localStorage.removeItem("access_token")

  // Store intended destination for post-login redirect
  const currentPath = window.location.pathname
  if (currentPath !== "/login" && currentPath !== "/signup") {
    sessionStorage.setItem("redirect_after_login", currentPath)
  }

  // Optional: Show user-friendly message
  if (message) {
    console.log("Auth error:", message)
  }

  window.location.href = "/login"
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
