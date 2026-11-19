import { getCategory } from "@/lib/constants";
import {
  addDays,
  dayKey,
  formatDayLabel,
  formatMonthLabel,
  monthKey,
  startOfDayUTC,
  startOfMonthUTC,
  startOfWeekUTC,
  addMonthsUTC,
  type Granularity,
} from "@/lib/dates";
import type { Txn } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type Summary = {
  income: number;
  expense: number;
  net: number;
  /** (income - expense) / income, as a percentage. null when there is no income. */
  savingsRate: number | null;
  count: number;
  expenseCount: number;
  avgExpense: number;
};

export function summarize(txns: Txn[]): Summary {
  let income = 0;
  let expense = 0;
  let expenseCount = 0;
  for (const t of txns) {
    if (t.type === "INCOME") income += t.amount;
    else {
      expense += t.amount;
      expenseCount++;
    }
  }
  const net = income - expense;
  return {
    income: round2(income),
    expense: round2(expense),
    net: round2(net),
    savingsRate: income > 0 ? (net / income) * 100 : null,
    count: txns.length,
    expenseCount,
    avgExpense: expenseCount ? round2(expense / expenseCount) : 0,
  };
}

export type CategorySlice = {
  category: string;
  label: string;
  amount: number;
  share: number; // 0-100
  count: number;
};

export function byCategory(txns: Txn[], type: "EXPENSE" | "INCOME" = "EXPENSE"): CategorySlice[] {
  const map = new Map<string, { amount: number; count: number }>();
  let total = 0;
  for (const t of txns) {
    if (t.type !== type) continue;
    const e = map.get(t.category) ?? { amount: 0, count: 0 };
    e.amount += t.amount;
    e.count++;
    map.set(t.category, e);
    total += t.amount;
  }
  return [...map.entries()]
    .map(([category, { amount, count }]) => ({
      category,
      label: getCategory(category).label,
      amount: round2(amount),
      share: total ? (amount / total) * 100 : 0,
      count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Keep the top N slices and fold the rest into a single "Other" slice, so a chart never
 * needs more categorical colors than the validated palette provides.
 */
export function foldSlices(slices: CategorySlice[], keep = 5): CategorySlice[] {
  if (slices.length <= keep + 1) return slices;
  const head = slices.slice(0, keep);
  const tail = slices.slice(keep);
  const amount = tail.reduce((a, s) => a + s.amount, 0);
  return [
    ...head,
    {
      category: "__other",
      label: `Other (${tail.length})`,
      amount: round2(amount),
      share: tail.reduce((a, s) => a + s.share, 0),
      count: tail.reduce((a, s) => a + s.count, 0),
    },
  ];
}

export type SeriesPoint = { key: string; label: string; income: number; expense: number; net: number };

function bucketKey(d: Date, g: Granularity): string {
  if (g === "day") return dayKey(d);
  if (g === "week") return dayKey(startOfWeekUTC(d));
  return monthKey(d);
}

/** Time series with every bucket in [from, to] present (zero-filled), so charts never skip gaps. */
export function timeSeries(txns: Txn[], from: Date, to: Date, granularity: Granularity): SeriesPoint[] {
  const buckets = new Map<string, SeriesPoint>();
  let cursor =
    granularity === "day"
      ? startOfDayUTC(from)
      : granularity === "week"
        ? startOfWeekUTC(from)
        : startOfMonthUTC(from);
  let guard = 0;
  while (cursor <= to && guard++ < 1000) {
    const key = bucketKey(cursor, granularity);
    const label =
      granularity === "month"
        ? formatMonthLabel(key)
        : granularity === "week"
          ? formatDayLabel(key)
          : formatDayLabel(key);
    buckets.set(key, { key, label, income: 0, expense: 0, net: 0 });
    cursor =
      granularity === "day" ? addDays(cursor, 1) : granularity === "week" ? addDays(cursor, 7) : addMonthsUTC(cursor, 1);
  }
  for (const t of txns) {
    if (t.date < from || t.date > to) continue;
    const b = buckets.get(bucketKey(t.date, granularity));
    if (!b) continue;
    if (t.type === "INCOME") b.income += t.amount;
    else b.expense += t.amount;
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    income: round2(b.income),
    expense: round2(b.expense),
    net: round2(b.income - b.expense),
  }));
}

export type MonthPoint = {
  month: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number | null;
};

export function monthlyTrend(txns: Txn[], months: string[]): MonthPoint[] {
  return months.map((m) => {
    const s = summarize(txns.filter((t) => monthKey(t.date) === m));
    return {
      month: m,
      label: formatMonthLabel(m),
      income: s.income,
      expense: s.expense,
      savings: s.net,
      savingsRate: s.savingsRate,
    };
  });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type WeekdayPoint = { day: string; total: number; average: number; occurrences: number };

/** Spending by day of week, averaged over how many times each weekday occurred in the range. */
export function weekdayDistribution(txns: Txn[], from: Date, to: Date): WeekdayPoint[] {
  const totals = new Array(7).fill(0);
  const occurrences = new Array(7).fill(0);
  for (let d = startOfDayUTC(from); d <= to; d = addDays(d, 1)) occurrences[(d.getUTCDay() + 6) % 7]++;
  for (const t of txns) {
    if (t.type !== "EXPENSE" || t.date < from || t.date > to) continue;
    totals[(t.date.getUTCDay() + 6) % 7] += t.amount;
  }
  return WEEKDAYS.map((day, i) => ({
    day,
    total: round2(totals[i]),
    average: occurrences[i] ? round2(totals[i] / occurrences[i]) : 0,
    occurrences: occurrences[i],
  }));
}

export function topMerchants(txns: Txn[], n = 5) {
  const map = new Map<string, { title: string; amount: number; count: number; category: string }>();
  for (const t of txns) {
    if (t.type !== "EXPENSE") continue;
    const key = t.title.trim().toLowerCase();
    const e = map.get(key) ?? { title: t.title.trim(), amount: 0, count: 0, category: t.category };
    e.amount += t.amount;
    e.count++;
    map.set(key, e);
  }
  return [...map.values()]
    .map((m) => ({ ...m, amount: round2(m.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

/** Last 7 calendar days of spending ending today (used by the dashboard weekly bar chart). */
export function lastSevenDays(txns: Txn[], now = new Date()) {
  const start = startOfDayUTC(addDays(now, -6));
  const out: { key: string; label: string; expense: number; income: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const key = dayKey(d);
    out.push({
      key,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(d),
      expense: 0,
      income: 0,
    });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const t of txns) {
    const i = idx.get(dayKey(t.date));
    if (i === undefined) continue;
    if (t.type === "EXPENSE") out[i].expense += t.amount;
    else out[i].income += t.amount;
  }
  return out.map((o) => ({ ...o, expense: round2(o.expense), income: round2(o.income) }));
}

export function weekendVsWeekday(txns: Txn[], from: Date, to: Date) {
  let weekendTotal = 0;
  let weekdayTotal = 0;
  let weekendDays = 0;
  let weekdayDays = 0;
  for (let d = startOfDayUTC(from); d <= to; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) weekendDays++;
    else weekdayDays++;
  }
  for (const t of txns) {
    if (t.type !== "EXPENSE" || t.date < from || t.date > to) continue;
    const dow = t.date.getUTCDay();
    if (dow === 0 || dow === 6) weekendTotal += t.amount;
    else weekdayTotal += t.amount;
  }
  return {
    weekendAvg: weekendDays ? weekendTotal / weekendDays : 0,
    weekdayAvg: weekdayDays ? weekdayTotal / weekdayDays : 0,
    weekendDays,
    weekdayDays,
  };
}
