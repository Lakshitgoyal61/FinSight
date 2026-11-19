import { addMonthsUTC, daysBetween, daysInMonthUTC, startOfDayUTC } from "@/lib/dates";
import type { GoalInput, SubscriptionInput } from "./types";

// ---------------- Budgets ----------------

export type BudgetState = "ok" | "warning" | "exceeded";

export function budgetState(spent: number, limit: number, alertThreshold = 80): BudgetState {
  if (limit <= 0) return spent > 0 ? "exceeded" : "ok";
  const pct = (spent / limit) * 100;
  if (pct > 100) return "exceeded";
  if (pct >= alertThreshold) return "warning";
  return "ok";
}

export type BudgetProgress = {
  spent: number;
  limit: number;
  remaining: number;
  utilization: number; // percent, may exceed 100
  state: BudgetState;
  /** Projected month-end spend at the current daily pace (only for the current month). */
  projected: number | null;
  /** Safe daily spend for the rest of the month (only for the current month). */
  dailyAllowance: number | null;
};

/**
 * @param monthStart first day of the budget month
 * @param now current time; projections are only computed when `now` is inside the budget month
 */
export function budgetProgress(
  spent: number,
  limit: number,
  alertThreshold: number,
  monthStart: Date,
  now = new Date(),
): BudgetProgress {
  const utilization = limit > 0 ? (spent / limit) * 100 : 0;
  const inMonth =
    now.getUTCFullYear() === monthStart.getUTCFullYear() && now.getUTCMonth() === monthStart.getUTCMonth();
  let projected: number | null = null;
  let dailyAllowance: number | null = null;
  if (inMonth) {
    const total = daysInMonthUTC(monthStart);
    const elapsed = now.getUTCDate();
    projected = Math.round((spent / elapsed) * total * 100) / 100;
    const daysLeft = total - elapsed + 1;
    dailyAllowance = Math.max(0, Math.round(((limit - spent) / daysLeft) * 100) / 100);
  }
  return {
    spent,
    limit,
    remaining: Math.round((limit - spent) * 100) / 100,
    utilization,
    state: budgetState(spent, limit, alertThreshold),
    projected,
    dailyAllowance,
  };
}

// ---------------- Subscriptions ----------------

export function monthlyEquivalent(amount: number, cycle: string): number {
  return cycle === "YEARLY" ? amount / 12 : amount;
}

export function yearlyEquivalent(amount: number, cycle: string): number {
  return cycle === "YEARLY" ? amount : amount * 12;
}

export function advancePaymentDate(date: Date, cycle: string): Date {
  return addMonthsUTC(date, cycle === "YEARLY" ? 12 : 1);
}

/**
 * Move a stale "next payment" date forward until it is today or later.
 * Used when displaying subscriptions whose date has passed without being marked paid.
 */
export function rollForward(date: Date, cycle: string, now = new Date()): Date {
  let d = date;
  const today = startOfDayUTC(now);
  let guard = 0;
  while (startOfDayUTC(d) < today && guard++ < 600) d = advancePaymentDate(d, cycle);
  return d;
}

export function upcomingPayments(subs: SubscriptionInput[], now = new Date(), withinDays = 7) {
  return subs
    .filter((s) => s.status === "ACTIVE")
    .map((s) => ({ ...s, daysUntil: daysBetween(now, s.nextPaymentDate) }))
    .filter((s) => s.daysUntil >= 0 && s.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function recurringTotals(subs: SubscriptionInput[]) {
  const active = subs.filter((s) => s.status === "ACTIVE");
  const monthly = active.reduce((a, s) => a + monthlyEquivalent(s.amount, s.billingCycle), 0);
  return {
    activeCount: active.length,
    monthly: Math.round(monthly * 100) / 100,
    yearly: Math.round(monthly * 12 * 100) / 100,
  };
}

// ---------------- Goals ----------------

export type GoalStatus = "completed" | "on_track" | "behind" | "overdue" | "no_deadline";

export type GoalProgress = {
  percent: number; // 0-100 (capped)
  remaining: number;
  status: GoalStatus;
  monthsLeft: number | null;
  /** Monthly contribution needed to reach the target by the target date. */
  monthlyNeeded: number | null;
  daysLeft: number | null;
};

export function goalProgress(goal: Pick<GoalInput, "target" | "saved" | "targetDate" | "createdAt">, now = new Date()): GoalProgress {
  const { target, saved, targetDate, createdAt } = goal;
  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  const remaining = Math.max(0, Math.round((target - saved) * 100) / 100);
  if (saved >= target) {
    return { percent: 100, remaining: 0, status: "completed", monthsLeft: null, monthlyNeeded: null, daysLeft: null };
  }
  if (!targetDate) {
    return { percent, remaining, status: "no_deadline", monthsLeft: null, monthlyNeeded: null, daysLeft: null };
  }
  const daysLeft = daysBetween(now, targetDate);
  if (daysLeft < 0) {
    return { percent, remaining, status: "overdue", monthsLeft: 0, monthlyNeeded: remaining, daysLeft };
  }
  const monthsLeft = Math.max(daysLeft / 30.44, 0.5);
  const monthlyNeeded = Math.round((remaining / monthsLeft) * 100) / 100;
  // On track if saved share >= elapsed share of the timeline (with a 10-point grace margin).
  const totalDays = Math.max(1, daysBetween(createdAt, targetDate));
  const elapsedPct = Math.min(100, (Math.max(0, daysBetween(createdAt, now)) / totalDays) * 100);
  const status: GoalStatus = percent + 10 >= elapsedPct ? "on_track" : "behind";
  return { percent, remaining, status, monthsLeft: Math.round(monthsLeft * 10) / 10, monthlyNeeded, daysLeft };
}
