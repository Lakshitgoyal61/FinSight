import { expect, type Page } from "@playwright/test";

export const DEMO = { email: "demo@finsight.app", password: "Demo@1234" };

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Create a fresh, onboarded account through the real API and leave the page signed in. */
export async function signUpFresh(page: Page, name = "Test User") {
  const email = uniqueEmail();
  const password = "Password123";
  const res = await page.request.post("/api/auth/signup", { data: { name, email, password } });
  expect(res.status()).toBe(201);
  const ob = await page.request.post("/api/onboarding", {
    data: { name, currency: "INR", monthlyIncome: null, financialGoals: [], budgetingStyle: "flexible" },
  });
  expect(ob.ok()).toBeTruthy();
  return { email, password };
}

export async function loginDemo(page: Page) {
  const res = await page.request.post("/api/auth/login", { data: DEMO });
  expect(res.ok()).toBeTruthy();
}

/** Fill and submit the global "Add transaction" dialog. */
export async function addTransaction(page: Page, t: { title: string; amount: string; type?: "Expense" | "Income"; category?: string }) {
  await page.getByRole("button", { name: "Add transaction" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (t.type === "Income") await dialog.getByRole("radio", { name: "Income" }).click();
  await dialog.getByLabel(/Merchant|Source/).fill(t.title);
  await dialog.getByLabel("Amount").fill(t.amount);
  if (t.category) await dialog.getByLabel("Category").selectOption(t.category);
  await dialog.getByRole("button", { name: /^Add (expense|income)$/ }).click();
  await expect(dialog).toBeHidden();
}
