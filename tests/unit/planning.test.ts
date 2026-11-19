import { describe, expect, it } from "vitest";
import { advancePaymentDate, budgetProgress, budgetState, goalProgress, monthlyEquivalent, recurringTotals, rollForward, upcomingPayments } from "@/lib/finance/planning";
import { computeHealthScore } from "@/lib/finance/health";
import { dateFromKey, dayKey } from "@/lib/dates";

describe("budgets", () => {
  it("classifies normal / approaching / exceeded", () => {
    expect(budgetState(500, 1000, 80)).toBe("ok");
    expect(budgetState(800, 1000, 80)).toBe("warning");
    expect(budgetState(1000, 1000, 80)).toBe("warning");
    expect(budgetState(1001, 1000, 80)).toBe("exceeded");
  });

  it("projects month-end spending and a daily allowance for the current month", () => {
    const p = budgetProgress(3000, 6000, 80, dateFromKey("2026-11-01"), dateFromKey("2026-11-10"));
    expect(p.projected).toBe(9000); // 300/day × 30 days
    expect(p.remaining).toBe(3000);
    expect(p.dailyAllowance).toBeCloseTo(3000 / 21, 1);
    expect(p.utilization).toBe(50);
  });

  it("does not project for past months", () => {
    const p = budgetProgress(3000, 6000, 80, dateFromKey("2026-10-01"), dateFromKey("2026-11-10"));
    expect(p.projected).toBeNull();
  });
});

describe("subscriptions", () => {
  it("normalises yearly cost to monthly", () => {
    expect(monthlyEquivalent(1200, "YEARLY")).toBe(100);
    expect(monthlyEquivalent(199, "MONTHLY")).toBe(199);
  });

  it("advances dates by billing cycle and clamps month ends", () => {
    expect(dayKey(advancePaymentDate(dateFromKey("2026-01-31"), "MONTHLY"))).toBe("2026-02-28");
    expect(dayKey(advancePaymentDate(dateFromKey("2026-03-04"), "YEARLY"))).toBe("2027-03-04");
  });

  it("rolls a stale date forward to today or later", () => {
    expect(dayKey(rollForward(dateFromKey("2026-08-05"), "MONTHLY", dateFromKey("2026-11-19")))).toBe("2026-12-05");
  });

  it("finds upcoming active payments and totals recurring cost", () => {
    const now = dateFromKey("2026-11-19");
    const subs = [
      { name: "A", amount: 100, billingCycle: "MONTHLY", category: "entertainment", nextPaymentDate: dateFromKey("2026-11-21"), status: "ACTIVE" },
      { name: "B", amount: 1200, billingCycle: "YEARLY", category: "shopping", nextPaymentDate: dateFromKey("2027-03-01"), status: "ACTIVE" },
      { name: "C", amount: 500, billingCycle: "MONTHLY", category: "health", nextPaymentDate: dateFromKey("2026-11-20"), status: "CANCELLED" },
    ];
    expect(upcomingPayments(subs, now, 7).map((s) => s.name)).toEqual(["A"]);
    expect(recurringTotals(subs)).toEqual({ activeCount: 2, monthly: 200, yearly: 2400 });
  });
});

describe("goals", () => {
  const createdAt = dateFromKey("2026-01-01");
  const targetDate = dateFromKey("2027-01-01");

  it("marks completed goals", () => {
    expect(goalProgress({ target: 1000, saved: 1000, targetDate, createdAt }).status).toBe("completed");
  });

  it("detects on-track vs behind schedule", () => {
    const mid = dateFromKey("2026-07-02"); // ~50% of the timeline elapsed
    expect(goalProgress({ target: 1000, saved: 500, targetDate, createdAt }, mid).status).toBe("on_track");
    expect(goalProgress({ target: 1000, saved: 200, targetDate, createdAt }, mid).status).toBe("behind");
  });

  it("calculates the monthly amount needed", () => {
    const p = goalProgress({ target: 12000, saved: 0, targetDate: dateFromKey("2027-11-19"), createdAt }, dateFromKey("2026-11-19"));
    expect(p.monthlyNeeded).toBeGreaterThan(950);
    expect(p.monthlyNeeded).toBeLessThan(1050);
  });

  it("handles overdue and open-ended goals", () => {
    expect(goalProgress({ target: 1000, saved: 100, targetDate: dateFromKey("2026-01-15"), createdAt }, dateFromKey("2026-11-19")).status).toBe("overdue");
    expect(goalProgress({ target: 1000, saved: 100, targetDate: null, createdAt }).status).toBe("no_deadline");
  });
});

describe("health score", () => {
  it("rewards healthy finances", () => {
    const h = computeHealthScore({
      avgMonthlyIncome: 70000,
      avgMonthlyExpense: 45000,
      projectedMonthExpense: 42000,
      baselineMonthlyExpense: 45000,
      budgetStates: ["ok", "ok", "ok"],
      recurringMonthly: 2000,
      goalStatuses: ["on_track", "completed"],
    });
    expect(h.score).toBeGreaterThanOrEqual(90);
    expect(h.label).toBe("Excellent");
    expect(h.components.reduce((a, c) => a + c.max, 0)).toBe(100);
  });

  it("penalises overspending", () => {
    const h = computeHealthScore({
      avgMonthlyIncome: 50000,
      avgMonthlyExpense: 52000,
      projectedMonthExpense: 70000,
      baselineMonthlyExpense: 52000,
      budgetStates: ["exceeded", "exceeded", "warning"],
      recurringMonthly: 15000,
      goalStatuses: ["behind"],
    });
    expect(h.score).toBeLessThan(45);
    expect(h.label).toBe("Needs attention");
  });

  it("reports 'Getting started' with no data", () => {
    const h = computeHealthScore({ avgMonthlyIncome: 0, avgMonthlyExpense: 0, projectedMonthExpense: null, baselineMonthlyExpense: 0, budgetStates: [], recurringMonthly: 0, goalStatuses: [] });
    expect(h.label).toBe("Getting started");
    expect(h.hasEnoughData).toBe(false);
  });
});
