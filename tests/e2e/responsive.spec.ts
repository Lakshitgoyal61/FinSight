import { expect, test } from "@playwright/test";
import { loginDemo } from "./helpers";

test.describe("Responsive navigation", () => {
  test("pages render without horizontal overflow and nav works", async ({ page }) => {
    await loginDemo(page);
    for (const path of ["/dashboard", "/transactions", "/analytics", "/budgets", "/goals", "/subscriptions", "/insights", "/settings", "/profile"]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      // Compare against the device width: on mobile, overflowing content silently widens the layout viewport.
      const deviceWidth = page.viewportSize()!.width;
      const widths = await page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(widths.inner, `${path} widened the layout viewport`).toBeLessThanOrEqual(deviceWidth);
      expect(widths.scroll - widths.inner, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
    }
  });

  test("mobile tab bar and slide-over menu navigate", async ({ page, isMobile }) => {
    await loginDemo(page);
    await page.goto("/dashboard");
    const tabBar = page.getByRole("navigation", { name: "Primary" });
    if (isMobile) {
      await expect(tabBar).toBeVisible();
      await tabBar.getByRole("link", { name: "Budgets" }).click();
      await expect(page).toHaveURL(/\/budgets/);
      await tabBar.getByRole("button", { name: "More" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Insights" }).click();
      await expect(page).toHaveURL(/\/insights/);
    } else {
      await expect(tabBar).toBeHidden();
    }
  });
});
