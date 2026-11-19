import { expect, test } from "@playwright/test";
import { addTransaction, signUpFresh } from "./helpers";

test.describe("Core finance flows (fresh account)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpFresh(page, "Flow Tester");
  });

  test("transaction CRUD, search and persistence", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByText("No transactions yet")).toBeVisible();

    await addTransaction(page, { title: "Swiggy dinner", amount: "450" });
    await addTransaction(page, { title: "Salary", amount: "50000", type: "Income", category: "salary" });

    const table = page.locator("table");
    await expect(table.getByRole("button", { name: "Swiggy dinner", exact: true })).toBeVisible();
    await expect(table.getByText("+₹50,000")).toBeVisible();

    // Persists after reload
    await page.reload();
    await expect(table.getByRole("button", { name: "Swiggy dinner", exact: true })).toBeVisible();

    // Edit
    await page.getByRole("button", { name: "Actions for Swiggy dinner" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount").fill("520");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(table.getByText("−₹520")).toBeVisible();

    // Search filter updates the URL and results
    await page.getByLabel("Search transactions").fill("salary");
    await expect(page).toHaveURL(/q=salary/);
    await expect(table.getByRole("button", { name: "Swiggy dinner", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Clear filters" }).first().click();

    // Type filter
    await page.getByLabel("Transaction type").selectOption("EXPENSE");
    await expect(table.getByRole("button", { name: "Salary", exact: true })).toBeHidden();
    await page.getByLabel("Transaction type").selectOption("");

    // Delete with confirmation
    await page.getByRole("button", { name: "Actions for Swiggy dinner" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(table.getByRole("button", { name: "Swiggy dinner", exact: true })).toBeHidden();
  });

  test("budgets recalculate as transactions change", async ({ page }) => {
    await page.goto("/budgets");
    await page.getByRole("button", { name: "Create a budget" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Category").selectOption("food");
    await dialog.getByLabel("Monthly limit").fill("1000");
    await dialog.getByRole("button", { name: "Create budget" }).click();
    await expect(page.getByText("₹1,000 left", { exact: true })).toBeVisible();

    await addTransaction(page, { title: "Restaurant", amount: "850", category: "food" });
    await expect(page.getByText("Approaching limit")).toBeVisible();
    await expect(page.getByText("₹150 left", { exact: true })).toBeVisible();

    await addTransaction(page, { title: "Cafe", amount: "300", category: "food" });
    await expect(page.getByText("₹150 over", { exact: true })).toHaveCount(2); // summary + card
    await expect(page.getByText("Approaching limit")).toBeHidden();

    // The API reflects the same state
    const data = await (await page.request.get("/api/budgets")).json();
    expect(data.budgets[0]).toMatchObject({ category: "food", spent: 1150, state: "exceeded" });
  });

  test("savings goals accept contributions and complete", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "New goal" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Goal name").fill("New Phone");
    await dialog.getByLabel("Target amount").fill("20000");
    await dialog.getByLabel(/Already saved/).fill("5000");
    await dialog.getByRole("button", { name: "Create goal" }).click();
    await expect(page.getByText("₹15,000 to go")).toBeVisible();

    await page.getByRole("button", { name: "Add money" }).click();
    await page.getByRole("dialog").getByLabel("Amount").fill("15000");
    await page.getByRole("dialog").getByRole("button", { name: "Add money" }).click();
    await expect(page.getByText("Goal reached")).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  });

  test("subscriptions: add, record payment, cancel", async ({ page }) => {
    await page.goto("/subscriptions");
    await page.getByRole("button", { name: "Add your first subscription" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Netflix");
    await dialog.getByLabel("Amount per cycle").fill("649");
    await dialog.getByRole("button", { name: "Add subscription" }).click();
    await expect(page.getByText("₹649").first()).toBeVisible();

    // Due today → "Mark paid" records an expense and advances the date
    await page.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByText(/payment recorded/)).toBeVisible();
    const tx = await (await page.request.get("/api/transactions?q=Netflix")).json();
    expect(tx.total).toBe(1);
    expect(tx.items[0]).toMatchObject({ amount: 649, type: "EXPENSE", category: "entertainment" });

    await page.getByRole("button", { name: "Actions for Netflix" }).click();
    await page.getByRole("menuitem", { name: "Cancel subscription" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel subscription" }).click();
    await expect(page.getByText("No active subscriptions.")).toBeVisible();
  });

  test("users cannot read or modify each other's data", async ({ page, browser }) => {
    const created = await (
      await page.request.post("/api/transactions", {
        data: { title: "Private", amount: 100, type: "EXPENSE", category: "food", date: "2026-01-10", paymentMethod: "UPI" },
      })
    ).json();
    const id = created.transaction.id as string;

    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const otherPage = await other.newPage();
    await signUpFresh(otherPage, "Intruder");
    expect((await otherPage.request.get(`/api/transactions/${id}`)).status()).toBe(404);
    expect((await otherPage.request.delete(`/api/transactions/${id}`)).status()).toBe(404);
    const list = await (await otherPage.request.get("/api/transactions")).json();
    expect(list.total).toBe(0);
    await other.close();

    expect((await page.request.get(`/api/transactions/${id}`)).status()).toBe(200);
  });

  test("CSV import validates rows before saving", async ({ page }) => {
    const csv = "date,title,amount,type,category\n2026-01-05,Groceries run,1200,expense,Groceries\nbad-date,Broken,10,expense,Food";
    const dry = await (await page.request.post("/api/transactions/import", { data: { csv, dryRun: true } })).json();
    expect(dry).toMatchObject({ totalRows: 2, validCount: 1, errorCount: 1 });
    expect((await (await page.request.get("/api/transactions")).json()).total).toBe(0);

    const real = await (await page.request.post("/api/transactions/import", { data: { csv } })).json();
    expect(real).toMatchObject({ imported: 1, skipped: 1 });
    const exported = await (await page.request.get("/api/transactions/export")).text();
    expect(exported).toContain("Groceries run");
  });
});
