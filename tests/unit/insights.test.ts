import { describe, expect, it } from "vitest";
import { generateInsights, type InsightInput } from "@/lib/finance/insights";
import type { Txn } from "@/lib/finance/types";
import { dateFromKey } from "@/lib/dates";

let n = 0;
const tx = (date: string, amount: number, category = "food", type: Txn["type"] = "EXPENSE", title = "Merchant"): Txn => ({
  id: `t${++n}`,
  title,
  amount,
  type,
  category,
  date: dateFromKey(date),
});

const NOW = dateFromKey("2026-11-19");

function base(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    now: NOW,
    currency: "INR",
    thisMonth: [],
    lastMonth: [],
    trailing90: [],
    budgets: [],
    subscriptions: [],
    goals: [],
    reminderDays: 7,
    ...overrides,
  };
}

describe("insights engine", () => {
  it("flags a category that grew vs the same point last month", () => {
    const insights = generateInsights(
      base({
        thisMonth: [tx("2026-11-05", 3000), tx("2026-11-12", 3000)],
        lastMonth: [tx("2026-10-05", 2000), tx("2026-10-12", 2000), tx("2026-10-28", 9000)], // the 28th is ignored (after day 19)
      }),
    );
    const up = insights.find((i) => i.id === "cat-up-food");
    expect(up).toBeDefined();
    expect(up!.title).toContain("50%");
  });

  it("raises budget alerts at threshold and when exceeded", () => {
    const insights = generateInsights(
      base({
        budgets: [
          { category: "shopping", limit: 5000, spent: 4200, alertThreshold: 80 },
          { category: "food", limit: 3000, spent: 3600, alertThreshold: 80 },
        ],
      }),
    );
    expect(insights.find((i) => i.id === "budget-near-shopping")?.kind).toBe("warning");
    expect(insights.find((i) => i.id === "budget-over-food")?.kind).toBe("alert");
    // Exceeded budgets are the highest priority
    expect(insights[0]!.id).toBe("budget-over-food");
  });

  it("warns when the pace projects an overspend", () => {
    const insights = generateInsights(base({ budgets: [{ category: "transport", limit: 3000, spent: 2300, alertThreshold: 90 }] }));
    expect(insights.some((i) => i.id === "budget-pace-transport")).toBe(true);
  });

  it("detects heavier weekend spending", () => {
    // Nov 2026: weekends on 1, 7, 8, 14, 15
    const thisMonth = [tx("2026-11-07", 2000), tx("2026-11-08", 2000), tx("2026-11-14", 2000), tx("2026-11-10", 300), tx("2026-11-17", 300)];
    expect(generateInsights(base({ thisMonth })).some((i) => i.id === "weekend-spending")).toBe(true);
  });

  it("lists upcoming subscription payments", () => {
    const insights = generateInsights(
      base({
        subscriptions: [
          { name: "Netflix", amount: 649, billingCycle: "MONTHLY", category: "entertainment", nextPaymentDate: dateFromKey("2026-11-21"), status: "ACTIVE" },
          { name: "Spotify", amount: 119, billingCycle: "MONTHLY", category: "entertainment", nextPaymentDate: dateFromKey("2026-11-24"), status: "ACTIVE" },
          { name: "Old", amount: 99, billingCycle: "MONTHLY", category: "entertainment", nextPaymentDate: dateFromKey("2026-11-20"), status: "CANCELLED" },
        ],
      }),
    );
    const subs = insights.find((i) => i.id === "subs-upcoming");
    expect(subs?.title).toBe("2 subscription payments coming up");
    expect(subs?.body).toContain("₹768");
  });

  it("detects an unusual transaction", () => {
    const history = Array.from({ length: 10 }, (_, i) => tx(`2026-09-${String(i + 10).padStart(2, "0")}`, 1000 + i * 50, "shopping"));
    const big = tx("2026-11-15", 15000, "shopping", "EXPENSE", "Croma");
    const insights = generateInsights(base({ trailing90: [...history, big] }));
    const unusual = insights.find((i) => i.id.startsWith("unusual-"));
    expect(unusual?.body).toContain("Croma");
  });

  it("reports savings ratio improvements", () => {
    const insights = generateInsights(
      base({
        thisMonth: [tx("2026-11-01", 60000, "salary", "INCOME"), tx("2026-11-03", 20000, "housing")],
        lastMonth: [tx("2026-10-01", 60000, "salary", "INCOME"), tx("2026-10-03", 40000, "housing")],
      }),
    );
    expect(insights.find((i) => i.id === "savings-up")?.kind).toBe("positive");
  });

  it("flags goals that are behind schedule", () => {
    const insights = generateInsights(
      base({
        goals: [{ id: "g1", title: "Laptop", target: 100000, saved: 10000, targetDate: dateFromKey("2027-01-31"), createdAt: dateFromKey("2026-01-01") }],
      }),
    );
    expect(insights.find((i) => i.id === "goal-behind-g1")).toBeDefined();
  });

  it("returns nothing invented when there is no data", () => {
    expect(generateInsights(base())).toEqual([]);
  });
});
