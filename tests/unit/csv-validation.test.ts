import { describe, expect, it } from "vitest";
import { parseTransactionsCsv, transactionsToCsv } from "@/lib/csv";
import { budgetSchema, changePasswordSchema, signupSchema, transactionSchema } from "@/lib/validators";
import { dateFromKey } from "@/lib/dates";

describe("CSV import", () => {
  it("parses valid rows with labels, aliases and Indian dates", () => {
    const csv = [
      "Date,Merchant,Amount,Type,Category,Payment Method,Notes",
      "2026-11-01,Monthly salary,68000,income,Salary,Bank Transfer,Nov",
      '02/11/2026,BigBasket,"1,450.50",expense,groceries,upi,',
    ].join("\n");
    const r = parseTransactionsCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.valid).toHaveLength(2);
    expect(r.valid[0]).toMatchObject({ type: "INCOME", category: "salary", amount: 68000, paymentMethod: "Bank Transfer" });
    expect(r.valid[1]).toMatchObject({ date: "2026-11-02", amount: 1450.5, category: "groceries", paymentMethod: "UPI" });
  });

  it("reports row-level errors without rejecting valid rows", () => {
    const csv = ["date,title,amount,type", "2026-11-01,Coffee,180,expense", "not-a-date,Tea,50,expense", "2026-11-03,,90,expense", "2026-11-04,Thing,abc,expense", "2026-11-05,X,10,refund"].join("\n");
    const r = parseTransactionsCsv(csv);
    expect(r.valid).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(r.errors[3]!.message).toContain("Unknown type");
  });

  it("requires the essential columns", () => {
    const r = parseTransactionsCsv("name,price\nA,1");
    expect(r.errors[0]!.message).toMatch(/Missing required columns: date, amount/);
  });

  it("falls back to Other for unknown categories", () => {
    const r = parseTransactionsCsv("date,title,amount\n2026-11-01,Mystery,99");
    expect(r.valid[0]!.category).toBe("other");
  });

  it("round-trips export → import", () => {
    const csv = transactionsToCsv([
      { date: dateFromKey("2026-11-02"), title: 'Swiggy, "late night"', amount: 420, type: "EXPENSE", category: "food", paymentMethod: "UPI", description: null },
    ]);
    const r = parseTransactionsCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.valid[0]).toMatchObject({ title: 'Swiggy, "late night"', amount: 420, category: "food" });
  });
});

describe("validators", () => {
  it("rejects a category that doesn't match the type", () => {
    const r = transactionSchema.safeParse({ title: "Salary", amount: 100, type: "EXPENSE", category: "salary", date: "2026-11-01", paymentMethod: "UPI" });
    expect(r.success).toBe(false);
  });

  it("rejects non-positive and oversized amounts", () => {
    const ok = { title: "A", type: "EXPENSE", category: "food", date: "2026-11-01", paymentMethod: "UPI" };
    expect(transactionSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...ok, amount: 99_999_999 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...ok, amount: "250.255" }).data?.amount).toBe(250.26);
  });

  it("enforces password rules on signup", () => {
    expect(signupSchema.safeParse({ name: "Priya", email: "p@x.io", password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "Priya", email: "p@x.io", password: "longenough" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "Priya", email: "P@X.io", password: "longenough1" }).data?.email).toBe("p@x.io");
  });

  it("requires matching, different passwords on change", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "abc12345", newPassword: "abc12345", confirmPassword: "abc12345" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "abc12345", newPassword: "xyz12345", confirmPassword: "xyz00000" }).success).toBe(false);
  });

  it("only allows expense categories for budgets", () => {
    expect(budgetSchema.safeParse({ category: "salary", month: "2026-11", limit: 100 }).success).toBe(false);
    expect(budgetSchema.safeParse({ category: "food", month: "2026-13", limit: 100 }).success).toBe(false);
    expect(budgetSchema.safeParse({ category: "food", month: "2026-11", limit: 100 }).data?.alertThreshold).toBe(80);
  });
});
