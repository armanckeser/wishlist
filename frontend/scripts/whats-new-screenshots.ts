/**
 * Screenshot script for What's New images
 *
 * Takes screenshots from Storybook for the what's new modal.
 * Requires Storybook to be running on port 6006.
 *
 * Usage:
 *   # Start Storybook first
 *   npm run storybook
 *
 *   # In another terminal
 *   npx tsx scripts/whats-new-screenshots.ts
 */

import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { chromium } from "playwright"

interface Screenshot {
  /** Storybook story ID (lowercase, dashes) */
  storyId: string
  /** Output path relative to frontend/ */
  output: string
  /** Viewport size */
  viewport: { width: number; height: number }
  /** Optional: wait for specific selector */
  waitFor?: string
  /** Optional: delay after load (ms) for animations */
  delay?: number
}

const STORYBOOK_URL = "http://localhost:6006"
const THEME = "dark" // Use midnight theme

const SCREENSHOTS: Screenshot[] = [
  // Waive Cooldown Dialog - "Skip the Wait" section
  {
    storyId: "components-wishlistitem-waivecooldowndialog--default",
    output: "public/whats-new/waive-cooldown.png",
    viewport: { width: 550, height: 450 },
    delay: 300,
  },
  // Package Delivered Notification - "Stay in the Loop" section
  {
    storyId: "components-notifications-notificationitem--package-delivered",
    output: "public/whats-new/tracking-notification.png",
    viewport: { width: 400, height: 120 },
    delay: 300,
  },
  // Price Tracking Section - "Watch Prices Drop" section
  {
    storyId: "components-pricetracking-pricetrackingsection--tracking",
    output: "public/whats-new/price-tracking.png",
    viewport: { width: 420, height: 300 },
    delay: 300,
  },
]

async function takeScreenshot(shot: Screenshot) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: 2, // Retina quality
  })
  const page = await context.newPage()

  // Collect console errors
  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })

  try {
    // Storybook iframe URL for clean screenshots with dark theme
    const url = `${STORYBOOK_URL}/iframe.html?id=${shot.storyId}&viewMode=story&globals=theme:${THEME}`
    console.log(`  Loading: ${url}`)

    await page.goto(url, { waitUntil: "networkidle" })

    if (shot.waitFor) {
      await page.waitForSelector(shot.waitFor)
    }

    // Wait for animations
    await page.waitForTimeout(shot.delay ?? 500)

    // Check for Storybook errors before taking screenshot
    const errorElement = await page
      .locator("#error-message, [role='alert']")
      .first()
    const errorVisible = await errorElement.isVisible().catch(() => false)

    if (errorVisible) {
      const errorText = await errorElement.textContent()
      throw new Error(`Story error detected: ${errorText}`)
    }

    // Check for common React error patterns in the page text
    const pageText = await page.locator("body").textContent()
    if (
      pageText &&
      /Error:|must be used within|Cannot read|undefined is not/i.test(pageText)
    ) {
      // Extract first line that looks like an error
      const errorMatch = pageText.match(
        /(Error:[^\n]+|must be used within [^\n]+|Cannot read[^\n]+)/i,
      )
      if (errorMatch) {
        throw new Error(`Component error detected: ${errorMatch[1].trim()}`)
      }
    }

    // Check if storybook root is empty (component didn't render)
    const storybookRoot = page.locator("#storybook-root")
    const isEmpty = await storybookRoot.evaluate((el) => !el.hasChildNodes())
    if (isEmpty) {
      throw new Error("Story container is empty - component did not render")
    }

    // Report console errors as warnings (don't fail, but inform)
    if (consoleErrors.length > 0) {
      console.log(`  ⚠️  Console errors detected (${consoleErrors.length}):`)
      consoleErrors.slice(0, 3).forEach((err) => {
        console.log(`     ${err.substring(0, 100)}`)
      })
    }

    // Ensure output directory exists
    await mkdir(dirname(shot.output), { recursive: true })

    await page.screenshot({
      path: shot.output,
      fullPage: false,
    })

    console.log(`  ✓ Saved: ${shot.output}`)
  } catch (error) {
    console.error(`  ✗ Failed: ${shot.output}`)
    if (consoleErrors.length > 0) {
      console.error("\n  Console errors:")
      for (const err of consoleErrors) {
        console.error(`    ${err}`)
      }
    }
    throw error
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log("\n📸 Taking What's New screenshots...\n")
  console.log("Make sure Storybook is running: npm run storybook\n")

  for (const shot of SCREENSHOTS) {
    console.log(`\n${shot.storyId}`)
    await takeScreenshot(shot)
  }

  console.log("\n✅ All screenshots complete!\n")
  console.log("Update frontend/src/config/whats-new.ts with image paths:")
  console.log("  image: '/whats-new/gift-dialog.png'")
  console.log("  image: '/whats-new/notifications.png'")
  console.log("  etc.\n")
}

main().catch((err) => {
  console.error("\n❌ Screenshot failed:", err.message)
  console.error("\nMake sure Storybook is running on port 6006")
  process.exit(1)
})
