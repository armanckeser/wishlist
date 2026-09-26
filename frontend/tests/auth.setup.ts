import { test as setup } from "@playwright/test"
import { WHATS_NEW_VERSION } from "../src/config/whats-new.ts"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"

const authFile = "playwright/.auth/user.json"

setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByTestId("email-input").fill(firstSuperuser)
  await page.getByTestId("password-input").fill(firstSuperuserPassword)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("/")

  // Set localStorage to prevent "What's New" dialog from appearing in tests
  await page.evaluate((version) => {
    localStorage.setItem("lastSeenWhatsNewVersion", version)
  }, WHATS_NEW_VERSION)

  await page.context().storageState({ path: authFile })
})
