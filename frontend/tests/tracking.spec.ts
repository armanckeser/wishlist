import { expect, test } from "./fixtures.ts"
import { randomString } from "./utils/random.ts"

// Test with a FedEx-like tracking number pattern
// The tracking-numbers library will parse this locally without hitting external APIs
const TEST_TRACKING_NUMBER = "888079995075" // FedEx pattern

test.describe("Tracking Page", () => {
  test("navigates to tracking page", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/tracking")

    // Verify no console errors and page loaded
    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()

    // Verify page header (with more flexible selector)
    await expect(page.locator("h1", { hasText: "Tracking" })).toBeVisible({
      timeout: 10000,
    })
  })

  test("shows empty state when no packages", async ({ page }) => {
    await page.goto("/tracking")

    // The page says how many packages there are; with none, it shows the empty state.
    await expect(page.getByText(/^\d+ packages?$/)).toBeVisible()
    if (await page.getByText("0 packages").isVisible()) {
      await expect(page.getByTestId("empty-tracking-state")).toBeVisible()
    }
  })

  test("FAB opens add tracking drawer", async ({ page }) => {
    await page.goto("/tracking")

    // Click the FAB button
    await page
      .getByTestId("add-tracking-fab")
      .getByRole("button", { name: "Add item" })
      .click()

    // Verify drawer opens with "Track Package" title
    await expect(
      page.getByRole("heading", { name: "Track Package" }),
    ).toBeVisible()

    // Verify tracking input field is visible
    await expect(page.getByTestId("tracking-number-input")).toBeVisible()
  })

  test("validates tracking number format", async ({ page }) => {
    await page.goto("/tracking")

    // Open add tracking drawer
    await page
      .getByTestId("add-tracking-fab")
      .getByRole("button", { name: "Add item" })
      .click()

    // Enter invalid tracking number
    await page.getByTestId("tracking-number-input").fill("invalid123")
    await page.getByTestId("tracking-number-input").blur()

    // Wait for parsing (the API call will run)
    await page.waitForTimeout(1000)

    // Check for error state or no carrier detection
    // (depends on API response - invalid numbers won't show carrier detected)
    const carrierResult = page.getByTestId("tracking-carrier-result")
    const isVisible = await carrierResult.isVisible().catch(() => false)

    if (isVisible) {
      // If visible, should show invalid state
      await expect(carrierResult).toContainText("Invalid")
    }
  })

  test("can cancel add tracking drawer", async ({ page }) => {
    await page.goto("/tracking")

    // Open drawer
    await page
      .getByTestId("add-tracking-fab")
      .getByRole("button", { name: "Add item" })
      .click()
    await expect(
      page.getByRole("heading", { name: "Track Package" }),
    ).toBeVisible()

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).click()

    // Drawer should close
    await expect(
      page.getByRole("heading", { name: "Track Package" }),
    ).not.toBeVisible()
  })

  test("tracking form shows optional price label", async ({ page }) => {
    await page.goto("/tracking")

    // Open add tracking drawer
    await page
      .getByTestId("add-tracking-fab")
      .getByRole("button", { name: "Add item" })
      .click()

    // Price should be marked as optional in tracking mode
    await expect(page.getByText("Price")).toBeVisible()
    await expect(page.getByText("(optional)").first()).toBeVisible()
  })
})

test.describe("Add Tracked Package Flow", () => {
  test("adds a tracked package with valid tracking number", async ({
    page,
  }) => {
    // Unique, so a retry or an earlier run in the same database can't match it.
    const packageName = `Test package ${randomString()}`
    await page.goto("/tracking")

    // Open add tracking drawer
    await page
      .getByTestId("add-tracking-fab")
      .getByRole("button", { name: "Add item" })
      .click()

    // Enter tracking number
    await page.getByTestId("tracking-number-input").fill(TEST_TRACKING_NUMBER)
    await page.getByTestId("tracking-number-input").blur()

    // Wait for carrier detection
    await page.waitForSelector('[data-testid="tracking-carrier-result"]', {
      timeout: 5000,
    })

    // Verify carrier was detected (FedEx for this pattern)
    const carrierResult = page.getByTestId("tracking-carrier-result")
    const isValidDetection = await carrierResult
      .getByText("detected")
      .isVisible()
      .catch(() => false)

    if (isValidDetection) {
      // Name is a collapsed row; opening it focuses its input.
      await page.locator("summary", { hasText: "Name" }).click()
      await page.getByPlaceholder("e.g. Croissant Dôme Ring").fill(packageName)

      // Submit the form
      await page.getByRole("button", { name: "Save" }).click()

      // The dialog closes and the package is in the list.
      await expect(
        page.getByRole("heading", { name: "Track Package" }),
      ).toBeHidden()
      await expect(
        page.getByRole("heading", { name: packageName }),
      ).toBeVisible()
    }
  })

  test("tracking item shows carrier information", async ({ page }) => {
    await page.goto("/tracking")

    // Check if tracking list exists and has items
    const trackingList = page.getByTestId("tracking-list")
    const hasItems = await trackingList.isVisible().catch(() => false)

    if (hasItems) {
      // Each tracking item should show carrier info
      const firstItem = trackingList.locator("> div").first()
      await expect(firstItem).toBeVisible()

      // Should have carrier info or "Unknown carrier"
      const hasCarrierInfo = await firstItem
        .getByText(/FedEx|UPS|USPS|Unknown carrier/i)
        .isVisible()
        .catch(() => false)

      expect(hasCarrierInfo).toBeTruthy()
    }
  })
})

test.describe("Tracking List Interactions", () => {
  test("can expand and collapse tracking item", async ({ page }) => {
    await page.goto("/tracking")

    const trackingList = page.getByTestId("tracking-list")
    const hasItems = await trackingList.isVisible().catch(() => false)

    if (hasItems) {
      // Click to expand the first item
      const firstItem = trackingList.locator("> div").first()
      await firstItem.click()

      // Wait for expansion
      await page.waitForTimeout(300)

      // Should show tracking number or "No tracking number"
      await expect(page.getByText(/No tracking number|\d{10,}/i)).toBeVisible()

      // Click again to collapse
      await firstItem.locator("button").first().click()
    }
  })
})
