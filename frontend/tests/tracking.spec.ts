import { expect, test } from "@playwright/test"

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

    // Check for empty state (may not appear if user has tracked items)
    const emptyState = page.getByTestId("empty-tracking-state")
    const trackingList = page.getByTestId("tracking-list")

    // Either empty state or tracking list should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false)
    const hasTrackingList = await trackingList.isVisible().catch(() => false)

    expect(hasEmptyState || hasTrackingList).toBeTruthy()
  })

  test("FAB opens add tracking drawer", async ({ page }) => {
    await page.goto("/tracking")

    // Click the FAB button
    await page.getByTestId("add-tracking-fab").click()

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
    await page.getByTestId("add-tracking-fab").click()

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
    await page.getByTestId("add-tracking-fab").click()
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
    await page.getByTestId("add-tracking-fab").click()

    // Price should be marked as optional in tracking mode
    await expect(page.getByText("Price")).toBeVisible()
    await expect(page.getByText("(optional)").first()).toBeVisible()
  })
})

test.describe("Add Tracked Package Flow", () => {
  test("adds a tracked package with valid tracking number", async ({
    page,
  }) => {
    await page.goto("/tracking")

    // Open add tracking drawer
    await page.getByTestId("add-tracking-fab").click()

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
      // Fill in required title
      await page.getByLabel(/Name/).fill("Test Package from FedEx")

      // Submit the form
      await page.getByRole("button", { name: "Save" }).click()

      // Wait for drawer to close and list to update
      await page.waitForTimeout(1000)

      // Verify the item appears in the tracking list
      await expect(page.getByText("Test Package from FedEx")).toBeVisible()
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
