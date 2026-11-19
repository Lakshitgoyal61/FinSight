import { describe, expect, it } from "vitest";
import { byCategory, foldSlices, lastSevenDays, monthlyTrend, summarize, timeSeries, weekdayDistribution, weekendVsWeekday } from "@/lib/finance/analytics";
import type { Txn } from "@/lib/finance/types";
import { dateFromKey, resolveRange } from "@/lib/dates";

let n = 0;
const tx = (date: string, amount: number, type: Txn["type"] = "EXPENSE", category = "food", title = "Test"): Txn => ({
  id: String(++n),
  title,
  amount,
  type,
  category,
  date: dateFromKey(date),
});

describe("summarize", () => {
  it("totals income, expense, net and savings rate", () => {
    const s = summarize([tx("2026-11-01", 50000, "INCOME", "salary"), tx("2026-11-02", 10000), tx("2026-11-03", 5000, "EXPENSE", "shopping")]);
    expect(s.income).toBe(50000);
    expect(s.expense).toBe(15000);
    expect(s.net).toBe(35000);
    expect(s.savingsRate).toBeCloseTo(70);
    expect(s.avgExpense).toBe(7500);
  });

  it("has no savings rate without income", () => {
    expect(summarize([tx("2026-11-02", 100)]).savingsRate).toBeNull();
  });
});

describe("byCategory / foldSlices", () => {
  it("groups expenses, sorts descending and computes shares", () => {
    const cats = byCategory([tx("2026-11-01", 300, "EXPENSE", "food"), tx("2026-11-02", 700, "EXPENSE", "shopping"), tx("2026-11-03", 1000, "INCOME", "salary")]);
    expect(cats.map((c) => c.category)).toEqual(["shopping", "food"]);
    expect(cats[0]!.share).toBeCloseTo(70);
    expect(cats[0]!.label).toBe("Shopping");
  });

  it("folds the tail into Other", () => {
    const slices = ["a", "b", "c", "d", "e", "f", "g"].map((c, i) => ({ category: c, label: c, amount: 100 - i, share: 10, count: 1 }));
    const folded = foldSlices(slices, 5);
    expect(folded).toHaveLength(6);
    expect(folded[5]!.category).toBe("__other");
    expect(folded[5]!.amount).toBe(95 + 94);
  });
});

describe("timeSeries", () => {
  it("zero-fills every day in range", () => {
    const from = dateFromKey("2026-11-01");
    const to = dateFromKey("2026-11-05");
    const s = timeSeries([tx("2026-11-02", 200), tx("2026-11-02", 50), tx("2026-11-04", 1000, "INCOME", "salary")], from, to, "day");
    expect(s).toHaveLength(5);
    expect(s[1]!.expense).toBe(250);
    expect(s[3]!.income).toBe(1000);
    expect(s[0]!.expense).toBe(0);
  });

  it("buckets by month", () => {
    const s = timeSeries([tx("2026-09-10", 100), tx("2026-10-10", 200)], dateFromKey("2026-09-01"), dateFromKey("2026-10-31"), "month");
    expect(s.map((p) => p.key)).toEqual(["2026-09", "2026-10"]);
  });
});

describe("weekday patterns", () => {
  // 2026-11-14 is a Saturday, 2026-11-16 is a Monday
  it("averages spending per weekday occurrence", () => {
    const from = dateFromKey("2026-11-09");
    const to = dateFromKey("2026-11-15");
    const w = weekdayDistribution([tx("2026-11-14", 700), tx("2026-11-10", 100)], from, to);
    expect(w.find((d) => d.day === "Sat")!.average).toBe(700);
    expect(w.find((d) => d.day === "Tue")!.average).toBe(100);
  });

  it("compares weekend and weekday averages", () => {
    const from = dateFromKey("2026-11-09");
    const to = dateFromKey("2026-11-15");
    const r = weekendVsWeekday([tx("2026-11-14", 1000), tx("2026-11-15", 1000), tx("2026-11-10", 500)], from, to);
    expect(r.weekendDays).toBe(2);
    expect(r.weekdayDays).toBe(5);
    expect(r.weekendAvg).toBe(1000);
    expect(r.weekdayAvg).toBe(100);
  });

  it("returns the last 7 days ending today", () => {
    const days = lastSevenDays([tx("2026-11-19", 300), tx("2026-11-10", 999)], dateFromKey("2026-11-19"));
    expect(days).toHaveLength(7);
    expect(days[6]!.expense).toBe(300);
    expect(days.reduce((a, d) => a + d.expense, 0)).toBe(300);
  });
});

describe("monthlyTrend", () => {
  it("summarises each month", () => {
    const m = monthlyTrend([tx("2026-10-01", 1000, "INCOME", "salary"), tx("2026-10-05", 400)], ["2026-10", "2026-11"]);
    expect(m[0]!.savings).toBe(600);
    expect(m[1]!.income).toBe(0);
  });
});

describe("resolveRange", () => {
  const now = dateFromKey("2026-11-19");
  it("resolves presets with a previous comparison period", () => {
    const r = resolveRange("7d", now);
    expect(r.days).toBe(7);
    expect(r.granularity).toBe("day");
    expect(r.previous.to.getTime()).toBeLessThan(r.from.getTime());
  });
  it("picks coarser granularity for longer ranges", () => {
    expect(resolveRange("3m", now).granularity).toBe("week");
    expect(resolveRange("ytd", now).granularity).toBe("month");
  });
  it("normalises reversed custom ranges", () => {
    const r = resolveRange("custom", now, { from: "2026-10-31", to: "2026-10-01" });
    expect(r.from < r.to).toBe(true);
  });
});
