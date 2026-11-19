import "server-only";
import type { Transaction as TxnRow, Subscription as SubRow } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addDays,
  addMonthsUTC,
  daysBetween,
  dayKey,
  endOfMonthUTC,
  monthBounds,
  monthKey,
  resolveRange,
  startOfDayUTC,
  startOfMonthUTC,
  type RangePreset,
} from "@/lib/dates";
import { fromMinor, percentChange } from "@/lib/money";
import {
  byCategory,
  foldSlices,
  lastSevenDays,
  monthlyTrend,
  summarize,
  timeSeries,
  topMerchants,
  weekdayDistribution,
  weekendVsWeekday,
} from "@/lib/finance/analytics";
import { computeHealthScore } from "@/lib/finance/health";
import { generateInsights } from "@/lib/finance/insights";
import {
  budgetProgress,
  goalProgress,
  monthlyEquivalent,
  recurringTotals,
  upcomingPayments,
} from "@/lib/finance/planning";
import type { Txn } from "@/lib/finance/types";

// ---------------- Mappers (DB minor units -> API major units) ----------------

export function toTxn(t: TxnRow): Txn {
  return {
    id: t.id,
    title: t.title,
    amount: fromMinor(t.amount),
    type: t.type as Txn["type"],
    category: t.category,
    date: t.date,
    paymentMethod: t.paymentMethod,
  };
}

export function serializeTransaction(t: TxnRow) {
  return {
    id: t.id,
    title: t.title,
    amount: fromMinor(t.amount),
    type: t.type as "INCOME" | "EXPENSE",
    category: t.category,
    date: dayKey(t.date),
    paymentMethod: t.paymentMethod,
    description: t.description,
    subscriptionId: t.subscriptionId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
export type TransactionDTO = ReturnType<typeof serializeTransaction>;

export function serializeSubscription(s: SubRow, now = new Date()) {
  const amount = fromMinor(s.amount);
  const daysUntil = daysBetween(now, s.nextPaymentDate);
  return {
    id: s.id,
    name: s.name,
    amount,
    billingCycle: s.billingCycle as "MONTHLY" | "YEARLY",
    category: s.category,
    nextPaymentDate: dayKey(s.nextPaymentDate),
    daysUntil,
    overdue: s.status === "ACTIVE" && daysUntil < 0,
    status: s.status as "ACTIVE" | "CANCELLED",
    paymentMethod: s.paymentMethod,
    notes: s.notes,
    startDate: dayKey(s.startDate),
    cancelledAt: s.cancelledAt?.toISOString() ?? null,
    monthlyCost: Math.round(monthlyEquivalent(amount, s.billingCycle) * 100) / 100,
  };
}
export type SubscriptionDTO = ReturnType<typeof serializeSubscription>;

// ---------------- Preferences ----------------

export async function getPreferences(userId: string) {
  const pref =
    (await db.userPreference.findUnique({ where: { userId } })) ??
    (await db.userPreference.create({ data: { userId } }));
  let goals: string[] = [];
  try {
    goals = JSON.parse(pref.financialGoals);
  } catch {
    goals = [];
  }
  return {
    currency: pref.currency,
    theme: pref.theme as "dark" | "light" | "system",
    monthlyIncome: pref.monthlyIncome === null ? null : fromMinor(pref.monthlyIncome),
    budgetingStyle: pref.budgetingStyle,
    financialGoals: goals,
    notifyBudgetAlerts: pref.notifyBudgetAlerts,
    notifySubscriptionReminders: pref.notifySubscriptionReminders,
    notifyGoalMilestones: pref.notifyGoalMilestones,
    notifyWeeklySummary: pref.notifyWeeklySummary,
    reminderDays: pref.reminderDays,
  };
}
export type PreferencesDTO = Awaited<ReturnType<typeof getPreferences>>;

// ---------------- Shared loaders ----------------

async function loadTransactions(userId: string, from: Date, to: Date) {
  const rows = await db.transaction.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return rows.map(toTxn);
}

async function loadBudgetsWithSpend(userId: string, month: string, txns?: Txn[], now = new Date()) {
  const { start, end } = monthBounds(month);
  const budgets = await db.budget.findMany({ where: { userId, month }, orderBy: { category: "asc" } });
  const monthTxns = txns ?? (await loadTransactions(userId, start, end));
  const spentBy = new Map<string, number>();
  for (const t of monthTxns) {
    if (t.type !== "EXPENSE" || t.date < start || t.date > end) continue;
    spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + t.amount);
  }
  return budgets.map((b) => {
    const spent = Math.round((spentBy.get(b.category) ?? 0) * 100) / 100;
    const limit = fromMinor(b.limit);
    return {
      id: b.id,
      category: b.category,
      month: b.month,
      alertThreshold: b.alertThreshold,
      ...budgetProgress(spent, limit, b.alertThreshold, start, now),
    };
  });
}

export async function getBudgets(userId: string, month: string, now = new Date()) {
  const budgets = await loadBudgetsWithSpend(userId, month, undefined, now);
  const { start, end } = monthBounds(month);
  const monthTxns = await loadTransactions(userId, start, end);
  const totals = summarize(monthTxns);
  const totalLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const totalSpentBudgeted = budgets.reduce((a, b) => a + b.spent, 0);
  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = byCategory(monthTxns).filter((c) => !budgeted.has(c.category));
  return {
    month,
    budgets,
    totals: {
      limit: Math.round(totalLimit * 100) / 100,
      spent: Math.round(totalSpentBudgeted * 100) / 100,
      monthExpense: totals.expense,
      monthIncome: totals.income,
      utilization: totalLimit ? (totalSpentBudgeted / totalLimit) * 100 : 0,
      exceeded: budgets.filter((b) => b.state === "exceeded").length,
      warning: budgets.filter((b) => b.state === "warning").length,
    },
    unbudgeted,
  };
}
export type BudgetsDTO = Awaited<ReturnType<typeof getBudgets>>;

export async function getGoals(userId: string, now = new Date()) {
  const goals = await db.savingsGoal.findMany({
    where: { userId },
    include: { contributions: { orderBy: { date: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  return goals.map((g) => {
    const saved = fromMinor(g.contributions.reduce((a, c) => a + c.amount, 0));
    const target = fromMinor(g.targetAmount);
    const progress = goalProgress({ target, saved, targetDate: g.targetDate, createdAt: g.createdAt }, now);
    return {
      id: g.id,
      title: g.title,
      target,
      saved,
      targetDate: g.targetDate ? dayKey(g.targetDate) : null,
      icon: g.icon,
      color: g.color,
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
      ...progress,
      contributions: g.contributions.map((c) => ({
        id: c.id,
        amount: fromMinor(c.amount),
        note: c.note,
        date: dayKey(c.date),
      })),
    };
  });
}
export type GoalDTO = Awaited<ReturnType<typeof getGoals>>[number];

export async function getSubscriptions(userId: string, now = new Date()) {
  const subs = await db.subscription.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { nextPaymentDate: "asc" }],
  });
  const list = subs.map((s) => serializeSubscription(s, now));
  const totals = recurringTotals(
    list.map((s) => ({ ...s, nextPaymentDate: new Date(`${s.nextPaymentDate}T12:00:00Z`) })),
  );
  const byCat = new Map<string, number>();
  for (const s of list) if (s.status === "ACTIVE") byCat.set(s.category, (byCat.get(s.category) ?? 0) + s.monthlyCost);
  // Actual paid history for the last 6 months (from linked transactions)
  const from = startOfMonthUTC(addMonthsUTC(now, -5));
  const paid = await db.transaction.findMany({
    where: { userId, subscriptionId: { not: null }, date: { gte: from } },
    select: { amount: true, date: true },
  });
  const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonthsUTC(startOfMonthUTC(now), i - 5)));
  const history = months.map((m) => ({
    month: m,
    amount: fromMinor(paid.filter((p) => monthKey(p.date) === m).reduce((a, p) => a + p.amount, 0)),
  }));
  return {
    subscriptions: list,
    totals,
    byCategory: [...byCat.entries()]
      .map(([category, monthly]) => ({ category, monthly: Math.round(monthly * 100) / 100 }))
      .sort((a, b) => b.monthly - a.monthly),
    history,
  };
}
export type SubscriptionsDTO = Awaited<ReturnType<typeof getSubscriptions>>;

// ---------------- Insights + health ----------------

export async function getInsightsAndHealth(userId: string, now = new Date()) {
  const pref = await getPreferences(userId);
  const monthStart = startOfMonthUTC(now);
  const lastMonthStart = addMonthsUTC(monthStart, -1);
  const threeMonthsAgo = addMonthsUTC(monthStart, -3);
  const trailingStart = startOfDayUTC(addDays(now, -90));
  const from = threeMonthsAgo < trailingStart ? threeMonthsAgo : trailingStart;

  const [txns, budgets, subsRaw, goals] = await Promise.all([
    loadTransactions(userId, from, now),
    loadBudgetsWithSpend(userId, monthKey(now), undefined, now),
    db.subscription.findMany({ where: { userId } }),
    getGoals(userId, now),
  ]);

  const subs = subsRaw.map((s) => {
    const dto = serializeSubscription(s, now);
    return { ...dto, nextPaymentDate: new Date(`${dto.nextPaymentDate}T12:00:00Z`) };
  });
  const thisMonth = txns.filter((t) => t.date >= monthStart);
  const lastMonth = txns.filter((t) => t.date >= lastMonthStart && t.date < monthStart);
  const trailing90 = txns.filter((t) => t.date >= trailingStart);

  const insights = generateInsights({
    now,
    currency: pref.currency,
    thisMonth,
    lastMonth,
    trailing90,
    budgets: budgets.map((b) => ({ category: b.category, limit: b.limit, spent: b.spent, alertThreshold: b.alertThreshold })),
    subscriptions: subs,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      target: g.target,
      saved: g.saved,
      targetDate: g.targetDate ? new Date(`${g.targetDate}T12:00:00Z`) : null,
      createdAt: new Date(g.createdAt),
    })),
    reminderDays: pref.reminderDays,
  });

  // Health: average of the 3 complete previous months, plus current-month projection.
  const prevMonths = [1, 2, 3].map((i) => monthKey(addMonthsUTC(monthStart, -i)));
  const trend = monthlyTrend(txns, prevMonths).filter((m) => m.income > 0 || m.expense > 0);
  const avgIncome = trend.length ? trend.reduce((a, m) => a + m.income, 0) / trend.length : summarize(thisMonth).income;
  const avgExpense = trend.length ? trend.reduce((a, m) => a + m.expense, 0) / trend.length : summarize(thisMonth).expense;
  const mtdExpense = summarize(thisMonth).expense;
  const dim = endOfMonthUTC(now).getUTCDate();
  const projected = now.getUTCDate() >= 3 ? (mtdExpense / now.getUTCDate()) * dim : null;

  const health = computeHealthScore({
    avgMonthlyIncome: avgIncome || pref.monthlyIncome || 0,
    avgMonthlyExpense: avgExpense,
    projectedMonthExpense: projected,
    baselineMonthlyExpense: avgExpense,
    budgetStates: budgets.map((b) => b.state),
    recurringMonthly: recurringTotals(subs).monthly,
    goalStatuses: goals.map((g) => g.status),
  });

  return { insights, health, currency: pref.currency };
}
export type InsightsDTO = Awaited<ReturnType<typeof getInsightsAndHealth>>;

// ---------------- Dashboard ----------------

export async function getDashboard(userId: string, now = new Date()) {
  const monthStart = startOfMonthUTC(now);
  const lastMonthStart = addMonthsUTC(monthStart, -1);
  const sixMonthsStart = addMonthsUTC(monthStart, -5);

  const [txns, totalsByType, prevTotalsByType, goals, subs, recentRows, insightsHealth, budgetsData, txnCount] =
    await Promise.all([
      loadTransactions(userId, sixMonthsStart < lastMonthStart ? sixMonthsStart : lastMonthStart, now),
      db.transaction.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } }),
      db.transaction.groupBy({ by: ["type"], where: { userId, date: { lt: monthStart } }, _sum: { amount: true } }),
      getGoals(userId, now),
      getSubscriptions(userId, now),
      db.transaction.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 6 }),
      getInsightsAndHealth(userId, now),
      getBudgets(userId, monthKey(now), now),
      db.transaction.count({ where: { userId } }),
    ]);

  const sumType = (rows: typeof totalsByType, type: string) => fromMinor(rows.find((r) => r.type === type)?._sum.amount ?? 0);
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const savedThisMonth = goals
    .flatMap((g) => g.contributions)
    .filter((c) => c.date >= dayKey(monthStart))
    .reduce((a, c) => a + c.amount, 0);
  const savedBeforeThisMonth = totalSaved - savedThisMonth;

  const balance = sumType(totalsByType, "INCOME") - sumType(totalsByType, "EXPENSE") - totalSaved;
  const prevBalance = sumType(prevTotalsByType, "INCOME") - sumType(prevTotalsByType, "EXPENSE") - savedBeforeThisMonth;

  const thisMonth = txns.filter((t) => t.date >= monthStart);
  const lastMonthSamePeriod = txns.filter(
    (t) => t.date >= lastMonthStart && t.date < monthStart && t.date.getUTCDate() <= now.getUTCDate(),
  );
  const cur = summarize(thisMonth);
  const prev = summarize(lastMonthSamePeriod);

  // Daily spend this month vs last month (cumulative), for the spending overview line chart
  const dim = endOfMonthUTC(now).getUTCDate();
  const lastMonthTxns = txns.filter((t) => t.date >= lastMonthStart && t.date < monthStart);
  const dailyThis = new Array(dim).fill(0);
  const dailyLast = new Array(dim).fill(0);
  for (const t of thisMonth) if (t.type === "EXPENSE") dailyThis[t.date.getUTCDate() - 1] += t.amount;
  for (const t of lastMonthTxns) if (t.type === "EXPENSE" && t.date.getUTCDate() <= dim) dailyLast[t.date.getUTCDate() - 1] += t.amount;
  let accThis = 0;
  let accLast = 0;
  const spendingCurve = Array.from({ length: dim }, (_, i) => {
    accThis += dailyThis[i];
    accLast += dailyLast[i];
    return {
      day: i + 1,
      thisMonth: i + 1 <= now.getUTCDate() ? Math.round(accThis) : null,
      lastMonth: Math.round(accLast),
      daily: i + 1 <= now.getUTCDate() ? Math.round(dailyThis[i]) : null,
    };
  });

  const months = Array.from({ length: 6 }, (_, i) => monthKey(addMonthsUTC(monthStart, i - 5)));

  return {
    generatedAt: now.toISOString(),
    hasData: txnCount > 0,
    overview: {
      balance: Math.round(balance * 100) / 100,
      balanceChange: percentChange(balance, prevBalance),
      income: cur.income,
      incomeChange: percentChange(cur.income, prev.income),
      expense: cur.expense,
      expenseChange: percentChange(cur.expense, prev.expense),
      savings: Math.round(totalSaved * 100) / 100,
      savedThisMonth: Math.round(savedThisMonth * 100) / 100,
      savingsChange: percentChange(totalSaved, savedBeforeThisMonth),
      savingsRate: cur.savingsRate,
    },
    spendingCurve,
    monthly: monthlyTrend(txns, months),
    categories: foldSlices(byCategory(thisMonth), 5),
    week: lastSevenDays(txns, now),
    recent: recentRows.map(serializeTransaction),
    goals: [...goals]
      .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"))
      .slice(0, 3),
    upcoming: upcomingPayments(
      subs.subscriptions.map((s) => ({ ...s, nextPaymentDate: new Date(`${s.nextPaymentDate}T12:00:00Z`) })),
      now,
      14,
    )
      .slice(0, 4)
      .map((s) => ({ id: s.id, name: s.name, amount: s.amount, category: s.category, nextPaymentDate: dayKey(s.nextPaymentDate), daysUntil: s.daysUntil })),
    recurringMonthly: subs.totals.monthly,
    budgets: {
      utilization: budgetsData.totals.utilization,
      limit: budgetsData.totals.limit,
      spent: budgetsData.totals.spent,
      exceeded: budgetsData.totals.exceeded,
      warning: budgetsData.totals.warning,
      count: budgetsData.budgets.length,
      top: [...budgetsData.budgets].sort((a, b) => b.utilization - a.utilization).slice(0, 4),
    },
    health: insightsHealth.health,
    insights: insightsHealth.insights.slice(0, 4),
  };
}
export type DashboardDTO = Awaited<ReturnType<typeof getDashboard>>;

// ---------------- Analytics ----------------

export async function getAnalytics(
  userId: string,
  preset: RangePreset,
  custom?: { from?: string; to?: string },
  now = new Date(),
) {
  const range = resolveRange(preset, now, custom);
  const [txns, prevTxns, first] = await Promise.all([
    loadTransactions(userId, range.from, range.to),
    loadTransactions(userId, range.previous.from, range.previous.to),
    db.transaction.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  // Only compare periods when the user's history covers (nearly) all of the previous period;
  // otherwise percentages like "+900%" would be artefacts of missing data, not real change.
  const comparable = Boolean(first && first.date.getTime() <= addDays(range.previous.from, 3).getTime());
  const change = (cur: number, prev: number) => (comparable ? percentChange(cur, prev) : null);
  const summary = summarize(txns);
  const prevSummary = summarize(prevTxns);
  const categories = byCategory(txns);
  const prevCats = new Map(byCategory(prevTxns).map((c) => [c.category, c.amount]));

  // Month-by-month for the range (at least the months the range touches)
  const months: string[] = [];
  for (let m = startOfMonthUTC(range.from); m <= range.to; m = addMonthsUTC(m, 1)) months.push(monthKey(m));

  const ww = weekendVsWeekday(txns, range.from, range.to);

  return {
    range: {
      preset,
      from: dayKey(range.from),
      to: dayKey(range.to),
      days: range.days,
      granularity: range.granularity,
      previousFrom: dayKey(range.previous.from),
      previousTo: dayKey(range.previous.to),
      comparable,
    },
    summary: {
      ...summary,
      dailyAverage: Math.round((summary.expense / range.days) * 100) / 100,
      incomeChange: change(summary.income, prevSummary.income),
      expenseChange: change(summary.expense, prevSummary.expense),
      netChange: change(summary.net, prevSummary.net),
      prevSavingsRate: comparable ? prevSummary.savingsRate : null,
    },
    series: timeSeries(txns, range.from, range.to, range.granularity),
    monthly: monthlyTrend(txns, months),
    categories: categories.map((c) => ({
      ...c,
      previous: Math.round((prevCats.get(c.category) ?? 0) * 100) / 100,
      change: change(c.amount, prevCats.get(c.category) ?? 0),
    })),
    incomeCategories: byCategory(txns, "INCOME"),
    weekday: weekdayDistribution(txns, range.from, range.to),
    weekendVsWeekday: ww,
    merchants: topMerchants(txns, 6),
    paymentMethods: Object.entries(
      txns
        .filter((t) => t.type === "EXPENSE")
        .reduce<Record<string, number>>((a, t) => ({ ...a, [t.paymentMethod ?? "Other"]: (a[t.paymentMethod ?? "Other"] ?? 0) + t.amount }), {}),
    )
      .map(([method, amount]) => ({ method, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
  };
}
export type AnalyticsDTO = Awaited<ReturnType<typeof getAnalytics>>;
