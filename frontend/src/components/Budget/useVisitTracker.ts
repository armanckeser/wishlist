const STORAGE_KEY = "wishlist_visit_data"

interface VisitData {
  lastVisitTime: number
  budgetCentsAtLastVisit: number
}

/**
 * Reads visit data from localStorage.
 * Returns null if no previous visit data exists.
 */
export function getLastVisitData(): VisitData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as VisitData
  } catch {
    return null
  }
}

/**
 * Saves current visit data to localStorage.
 */
export function saveVisitData(budgetCents: number): void {
  const data: VisitData = {
    lastVisitTime: Date.now(),
    budgetCentsAtLastVisit: budgetCents,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage might be full or disabled - ignore
  }
}

/**
 * Calculates the return bonus info if applicable.
 * Returns null if no meaningful return bonus (< 1 minute gap or < 1 cent gained).
 */
export function calculateReturnBonus(
  currentBudgetCents: number,
): { gainedCents: number; timeSinceLastVisit: number } | null {
  const lastVisit = getLastVisitData()

  if (!lastVisit) {
    return null
  }

  const timeSinceLastVisit = Date.now() - lastVisit.lastVisitTime
  const gainedCents = currentBudgetCents - lastVisit.budgetCentsAtLastVisit

  // Only show return bonus if:
  // - More than 1 minute has passed
  // - At least 1 cent was gained
  const ONE_MINUTE_MS = 60 * 1000
  if (timeSinceLastVisit < ONE_MINUTE_MS || gainedCents < 1) {
    return null
  }

  return {
    gainedCents,
    timeSinceLastVisit,
  }
}

/**
 * Formats milliseconds to a human-readable time string.
 */
export function formatTimeSince(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`
  }
  return "just now"
}
