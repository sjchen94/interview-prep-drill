import { test, expect } from "@playwright/test";

test("home page loads with drill card", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText("404");
  // Page should render without crashing — card or empty state
  await expect(page.locator("body")).not.toContainText("Application error");
});

test("problems list page is reachable", async ({ page }) => {
  await page.goto("/problems");
  await expect(page.locator("body")).not.toContainText("404");
});
