import type { ParseUrlResponse } from "@/client"

/**
 * Determines if a parse result contains sufficient data for auto-fill.
 *
 * Success criteria: BOTH title AND price must be present.
 * - Title only (no price): Insufficient - user must enter price manually
 * - Price only (no title): Insufficient - meaningless without product name
 * - Image only: Insufficient - requires product details
 * - Title + Price (± image): Success - all required fields present
 *
 * Note: image_url is optional bonus data when title + price exist.
 */
export function isUsefulParseResult(result: ParseUrlResponse): boolean {
  return Boolean(result.title && result.price_cents)
}
