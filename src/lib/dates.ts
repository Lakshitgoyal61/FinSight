/**
 * Date helpers. FinSight treats transaction dates as calendar days: a date is stored as
 * 12:00 UTC on that day, and every grouping uses UTC calendar parts. This keeps
 * day/week/month buckets stable regardless of the server or browser timezone.
 */

export const DAY_MS = 86_400_000;

/** "2026-11-19" -> Date at 12:00 UTC */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

/** Date -> "2026-11-19" (UTC calendar day) */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date -> "2026-11" */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function addMonthsUTC(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, d.getUTCHours()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function daysInMonthUTC(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Monday-based ISO week start for a date (UTC). */
export function startOfWeekUTC(d: Date): Date {
  const s = startOfDayUTC(d);
  const dow = (s.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(s, -dow);
}

/** Parse "YYYY-MM" into the first and last instant of that month. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  return { start, end: endOfMonthUTC(start) };
}

export function shiftMonthKey(month: string, n: number): string {
  const { start } = monthBounds(month);
  return monthKey(addMonthsUTC(start, n));
}

export const RANGE_PRESETS = [
  { id: "7d", label: "Last 7 days", short: "7D" },
  { id: "30d", label: "Last 30 days", short: "30D" },
  { id: "3m", label: "Last 3 months", short: "3M" },
  { id: "6m", label: "Last 6 months", short: "6M" },
  { id: "ytd", label: "This year", short: "YTD" },
  { id: "custom", label: "Custom range", short: "Custom" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

export type Granularity = "day" | "week" | "month";

export type ResolvedRange = {
  preset: RangePreset;
  from: Date;
  to: Date;
  days: number;
  granularity: Granularity;
  /** The equally-long period immediately preceding [from, to] — used for comparisons. */
  previous: { from: Date; to: Date };
};

export function resolveRange(
  preset: RangePreset,
  now = new Date(),
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const to = endOfDayUTC(now);
  let from: Date;
  switch (preset) {
    case "7d":
      from = startOfDayUTC(addDays(now, -6));
      break;
    case "30d":
      from = startOfDayUTC(addDays(now, -29));
      break;
    case "3m":
      from = startOfDayUTC(addMonthsUTC(now, -3));
      from = addDays(from, 1);
      break;
    case "6m":
      from = startOfDayUTC(addDays(addMonthsUTC(now, -6), 1));
      break;
    case "ytd":
      from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
    case "custom": {
      const f = custom?.from ? startOfDayUTC(dateFromKey(custom.from)) : startOfDayUTC(addDays(now, -29));
      const t = custom?.to ? endOfDayUTC(dateFromKey(custom.to)) : to;
      const [a, b] = f <= t ? [f, t] : [startOfDayUTC(t), endOfDayUTC(f)];
      return finalize(preset, a, b);
    }
  }
  return finalize(preset, from, to);
}

function finalize(preset: RangePreset, from: Date, to: Date): ResolvedRange {
  const days = Math.max(1, Math.round((endOfDayUTC(to).getTime() - startOfDayUTC(from).getTime()) / DAY_MS));
  const granularity: Granularity = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = startOfDayUTC(addDays(from, -days));
  return { preset, from, to, days, granularity, previous: { from: prevFrom, to: prevTo } };
}

export function formatDayLabel(key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(dateFromKey(key));
}

export function formatMonthLabel(month: string, long = false) {
  return new Intl.DateTimeFormat("en-IN", {
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(dateFromKey(`${month}-15`));
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(date);
}

/** Whole days from `from` to `to` by calendar day (UTC). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime()) / DAY_MS);
}

export function relativeDayLabel(target: Date, now = new Date()): string {
  const diff = daysBetween(now, target);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}
