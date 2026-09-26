import { expect, test } from "@playwright/test"

test.describe("Public Pages Rendering", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("login page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    // Verify key elements exist
    await expect(page.getByTestId("email-input")).toBeVisible()
    await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
  })

  test("signup page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(page.getByTestId("email-input")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible()
  })

  test("recover-password page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/recover-password")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(page.getByTestId("email-input")).toBeVisible()
  })
})

test.describe("Protected Pages Rendering", () => {
  test("home page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("tracking page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/tracking")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(page.getByRole("heading", { name: "Tracking" })).toBeVisible()
  })

  test("settings page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(
      page.getByRole("heading", { name: "User Settings" }),
    ).toBeVisible()
  })

  test("sharing page renders without errors", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/sharing")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(
      page.getByRole("heading", { name: "Sharing", exact: true }),
    ).toBeVisible()
  })

  test("admin page renders without errors for superuser", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto("/admin")
    await page.waitForLoadState("networkidle")

    expect(consoleErrors).toEqual([])
    await expect(page.locator("body")).not.toBeEmpty()
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
  })
})
