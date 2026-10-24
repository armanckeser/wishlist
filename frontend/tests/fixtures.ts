import { test as base } from "@playwright/test"
import { WHATS_NEW_VERSION } from "../src/config/whats-new.ts"

// Every test starts as a returning user who has seen this version's "What's New" drawer, which
// otherwise opens over the page on first visit (src/hooks/useWhatsNew.ts) and covers what a test clicks.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((version) => {
      localStorage.setItem("lastSeenWhatsNewVersion", version)
    }, WHATS_NEW_VERSION)
    await use(page)
  },
})

export { expect } from "@playwright/test"
