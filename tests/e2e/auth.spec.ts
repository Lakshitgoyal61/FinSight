import { expect, test } from "@playwright/test";
import { DEMO, uniqueEmail } from "./helpers";

test.describe("Authentication & onboarding", () => {
  test("protected pages redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    const res = await page.request.get("/api/dashboard");
    expect(res.status()).toBe(401);
  });

  test("shows a clear error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Incorrect email or password")).toBeVisible();
  });

  test("validates the sign-up form before submitting", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("new user signs up, completes onboarding, sees the welcome state, and logs out", async ({ page }) => {
    const email = uniqueEmail("signup");
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Priya Sharma");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Password123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole("button", { name: "Continue" }).click(); // name
    await page.getByLabel(/Monthly take-home income/).fill("60000");
    await page.getByRole("button", { name: "Continue" }).click(); // money
    await page.getByRole("button", { name: "Skip" }).click(); // goals
    await page.getByRole("radio", { name: /50 \/ 30 \/ 20/ }).click();
    await page.getByRole("button", { name: "Go to my dashboard" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome to FinSight, Priya/ })).toBeVisible();

    // Starter budgets were created from income + style
    await page.goto("/budgets");
    await expect(page.getByRole("heading", { name: "Rent & Housing" })).toBeVisible();

    // Logout invalidates the session
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("demo login reaches a populated dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Explore the live demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Total balance")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent transactions" })).toBeVisible();
  });
});
