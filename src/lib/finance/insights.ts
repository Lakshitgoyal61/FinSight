import { DISCRETIONARY_CATEGORIES, getCategory } from "@/lib/constants";
import { addDays, daysInMonthUTC, startOfDayUTC } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { byCategory, summarize, weekendVsWeekday } from "./analytics";
import { goalProgress, monthlyEquivalent, upcomingPayments } from "./planning";
import type { BudgetInput, GoalInput, SubscriptionInput, Txn } from "./types";

export type InsightKind = "alert" | "warning" | "positive" | "tip" | "info";
export type InsightTopic = "spending" | "budget" | "savings" | "subscriptions" | "goals" | "income";

export type Insight = {
  id: string;
  kind: InsightKind;
  topic: InsightTopic;
  title: string;
  body: string;
  /** Higher = shown first. */
  priority: number;
  metric?: { label: string; value: string };
  action?: { label: string; href: string };
};

export type InsightInput = {
  now: Date;
  currency: string;
  /** Transactions from the 1st of the current month up to now. */
  thisMonth: Txn[];
  /** Transactions from the whole previous month. */
  lastMonth: Txn[];
  /** Expenses from the trailing 90 days (anomaly detection baseline). */
  trailing90: Txn[];
  budgets: BudgetInput[];
  subscriptions: SubscriptionInput[];
  goals: GoalInput[];
  reminderDays?: number;
};

const MIN_CHANGE_ABS = 500; // ignore tiny swings (major units)

/**
 * Local, deterministic, explainable insights. Every insight is derived from the user's own
 * records with a documented rule — no external AI and no invented numbers.
 */
export function generateInsights(input: InsightInput): Insight[] {
  const { now, currency } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const out: Insight[] = [];
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = daysInMonthUTC(now);

  // Compare month-to-date against the SAME number of days last month (fair comparison).
  const lastMonthSamePeriod = input.lastMonth.filter((t) => t.date.getUTCDate() <= dayOfMonth);
  const thisCats = byCategory(input.thisMonth);
  const lastCats = new Map(byCategory(lastMonthSamePeriod).map((c) => [c.category, c.amount]));

  // Rule 1 — category month-over-month change
  for (const c of thisCats) {
    const prev = lastCats.get(c.category) ?? 0;
    const diff = c.amount - prev;
    if (prev <= 0 || Math.abs(diff) < MIN_CHANGE_ABS) continue;
    const pct = (diff / prev) * 100;
    if (pct >= 15) {
      out.push({
        id: `cat-up-${c.category}`,
        kind: pct >= 40 ? "warning" : "info",
        topic: "spending",
        title: `${c.label} spending is up ${Math.round(pct)}%`,
        body: `You've spent ${fmt(c.amount)} on ${c.label.toLowerCase()} so far this month, ${fmt(diff)} more than at this point last month.`,
        priority: 60 + Math.min(pct, 100) / 5,
        metric: { label: "vs last month", value: `+${Math.round(pct)}%` },
        action: { label: "Review transactions", href: `/transactions?category=${c.category}` },
      });
    } else if (pct <= -15) {
      out.push({
        id: `cat-down-${c.category}`,
        kind: "positive",
        topic: "spending",
        title: `${c.label} spending is down ${Math.abs(Math.round(pct))}%`,
        body: `Nice work — ${fmt(Math.abs(diff))} less on ${c.label.toLowerCase()} than at this point last month.`,
        priority: 35,
        metric: { label: "vs last month", value: `${Math.round(pct)}%` },
      });
    }
  }

  // Rule 2 — budget alerts and month-end projections
  for (const b of input.budgets) {
    const label = getCategory(b.category).label;
    const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
    const projected = dayOfMonth > 0 ? (b.spent / dayOfMonth) * daysInMonth : b.spent;
    if (pct > 100) {
      out.push({
        id: `budget-over-${b.category}`,
        kind: "alert",
        topic: "budget",
        title: `${label} budget exceeded`,
        body: `You've spent ${fmt(b.spent)} of your ${fmt(b.limit)} limit — ${fmt(b.spent - b.limit)} over budget.`,
        priority: 95,
        metric: { label: "used", value: `${Math.round(pct)}%` },
        action: { label: "Adjust budget", href: "/budgets" },
      });
    } else if (pct >= b.alertThreshold) {
      out.push({
        id: `budget-near-${b.category}`,
        kind: "warning",
        topic: "budget",
        title: `Approaching your ${label.toLowerCase()} budget`,
        body: `${Math.round(pct)}% used with ${daysInMonth - dayOfMonth} days left. ${fmt(Math.max(0, b.limit - b.spent))} remains for the rest of the month.`,
        priority: 85,
        metric: { label: "used", value: `${Math.round(pct)}%` },
        action: { label: "View budgets", href: "/budgets" },
      });
    } else if (dayOfMonth >= 5 && projected > b.limit * 1.05) {
      out.push({
        id: `budget-pace-${b.category}`,
        kind: "warning",
        topic: "budget",
        title: `${label} is on pace to overspend`,
        body: `At your current pace you'll spend about ${fmt(Math.round(projected))} by month-end against a ${fmt(b.limit)} limit. Keeping to ${fmt(Math.floor(Math.max(0, (b.limit - b.spent) / Math.max(1, daysInMonth - dayOfMonth))))} a day keeps you on track.`,
        priority: 70,
        metric: { label: "projected", value: fmt(Math.round(projected)) },
        action: { label: "View budgets", href: "/budgets" },
      });
    }
  }

  // Rule 3 — weekend vs weekday spending (current month)
  if (dayOfMonth >= 7) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const ww = weekendVsWeekday(input.thisMonth, monthStart, now);
    if (ww.weekendDays >= 2 && ww.weekdayAvg > 0 && ww.weekendAvg > ww.weekdayAvg * 1.3) {
      const ratio = ww.weekendAvg / ww.weekdayAvg;
      out.push({
        id: "weekend-spending",
        kind: "info",
        topic: "spending",
        title: "You spend more on weekends",
        body: `Your average weekend day costs ${fmt(Math.round(ww.weekendAvg))}, ${ratio.toFixed(1)}× a typical weekday (${fmt(Math.round(ww.weekdayAvg))}). Planning weekend activities ahead can help.`,
        priority: 45,
        metric: { label: "weekend vs weekday", value: `${ratio.toFixed(1)}×` },
        action: { label: "See daily patterns", href: "/analytics" },
      });
    }
  }

  // Rule 4 — savings ratio change
  const thisSummary = summarize(input.thisMonth);
  const lastSummary = summarize(input.lastMonth);
  if (thisSummary.savingsRate !== null && lastSummary.savingsRate !== null && dayOfMonth >= 10) {
    const delta = thisSummary.savingsRate - lastSummary.savingsRate;
    if (delta >= 5) {
      out.push({
        id: "savings-up",
        kind: "positive",
        topic: "savings",
        title: "Your savings ratio improved",
        body: `You're keeping ${Math.round(thisSummary.savingsRate)}% of your income this month, up from ${Math.round(lastSummary.savingsRate)}% last month.`,
        priority: 50,
        metric: { label: "savings ratio", value: `${Math.round(thisSummary.savingsRate)}%` },
      });
    } else if (delta <= -5) {
      out.push({
        id: "savings-down",
        kind: "warning",
        topic: "savings",
        title: "Your savings ratio dropped",
        body: `You're keeping ${Math.round(thisSummary.savingsRate)}% of your income this month vs ${Math.round(lastSummary.savingsRate)}% last month.`,
        priority: 65,
        metric: { label: "savings ratio", value: `${Math.round(thisSummary.savingsRate)}%` },
        action: { label: "See where it went", href: "/analytics" },
      });
    }
  }
  // Only nudge once there is spending to compare against (new, empty accounts get the welcome flow instead).
  if (thisSummary.income === 0 && thisSummary.expense > 0 && dayOfMonth >= 5) {
    out.push({
      id: "no-income",
      kind: "info",
      topic: "income",
      title: "No income recorded this month",
      body: "Add your salary or other income so FinSight can calculate your savings ratio accurately.",
      priority: 40,
      action: { label: "Add income", href: "/transactions?new=income" },
    });
  }

  // Rule 5 — upcoming subscription payments
  const upcoming = upcomingPayments(input.subscriptions, now, input.reminderDays ?? 7);
  if (upcoming.length) {
    const total = upcoming.reduce((a, s) => a + s.amount, 0);
    const names = upcoming.slice(0, 3).map((s) => s.name);
    out.push({
      id: "subs-upcoming",
      kind: "info",
      topic: "subscriptions",
      title: `${upcoming.length} subscription payment${upcoming.length > 1 ? "s" : ""} coming up`,
      body: `${names.join(", ")}${upcoming.length > 3 ? " and more" : ""} will charge ${fmt(total)} in the next ${input.reminderDays ?? 7} days.`,
      priority: 55,
      metric: { label: "due soon", value: fmt(total) },
      action: { label: "Manage subscriptions", href: "/subscriptions" },
    });
  }

  // Rule 6 — overlapping subscriptions in one category
  const activeSubs = input.subscriptions.filter((s) => s.status === "ACTIVE");
  const subsByCat = new Map<string, SubscriptionInput[]>();
  for (const s of activeSubs) subsByCat.set(s.category, [...(subsByCat.get(s.category) ?? []), s]);
  for (const [cat, list] of subsByCat) {
    if (list.length < 3) continue;
    const monthly = list.reduce((a, s) => a + monthlyEquivalent(s.amount, s.billingCycle), 0);
    const cheapest = [...list].sort((a, b) => monthlyEquivalent(a.amount, a.billingCycle) - monthlyEquivalent(b.amount, b.billingCycle))[0]!;
    out.push({
      id: `subs-overlap-${cat}`,
      kind: "tip",
      topic: "subscriptions",
      title: `${list.length} ${getCategory(cat).label.toLowerCase()} subscriptions`,
      body: `They cost ${fmt(Math.round(monthly))}/month together (${fmt(Math.round(monthly * 12))}/year). If you rarely use one — for example ${cheapest.name} — cancelling it is an easy win.`,
      priority: 42,
      metric: { label: "per year", value: fmt(Math.round(monthly * 12)) },
      action: { label: "Review subscriptions", href: "/subscriptions" },
    });
  }

  // Rule 7 — unusual transactions (> mean + 2σ for the category, and at least 2.5× the median)
  const recentCutoff = startOfDayUTC(addDays(now, -14));
  const byCat = new Map<string, number[]>();
  for (const t of input.trailing90) if (t.type === "EXPENSE") byCat.set(t.category, [...(byCat.get(t.category) ?? []), t.amount]);
  const flagged = input.trailing90
    .filter((t) => t.type === "EXPENSE" && t.date >= recentCutoff)
    .filter((t) => {
      const values = byCat.get(t.category) ?? [];
      if (values.length < 5) return false;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      return t.amount > mean + 2 * sd && t.amount >= median * 2.5 && t.amount >= 1000;
    })
    .sort((a, b) => b.amount - a.amount);
  if (flagged[0]) {
    const t = flagged[0];
    const label = getCategory(t.category).label;
    out.push({
      id: `unusual-${t.id}`,
      kind: "warning",
      topic: "spending",
      title: "Unusual transaction detected",
      body: `${t.title} (${fmt(t.amount)}) is much larger than your typical ${label.toLowerCase()} purchase. If this was planned, you can ignore this.`,
      priority: 75,
      metric: { label: "amount", value: fmt(t.amount) },
      action: { label: "View transaction", href: `/transactions?q=${encodeURIComponent(t.title)}` },
    });
  }

  // Rule 8 — concentration in one discretionary category + savings suggestion
  const discretionary = thisCats.filter((c) => DISCRETIONARY_CATEGORIES.includes(c.category));
  const topDisc = discretionary[0];
  if (topDisc && topDisc.amount >= 1500 && dayOfMonth >= 5) {
    const projectedMonthly = (topDisc.amount / dayOfMonth) * daysInMonth;
    const saving = Math.round((projectedMonthly * 0.2) / 10) * 10;
    out.push({
      id: `suggest-${topDisc.category}`,
      kind: "tip",
      topic: "savings",
      title: `Trim ${topDisc.label.toLowerCase()} by 20% to save ${fmt(saving)}/month`,
      body: `${topDisc.label} is your biggest discretionary category this month (${Math.round(topDisc.share)}% of spending). A 20% cut would add about ${fmt(saving * 12)} to your savings over a year.`,
      priority: 48,
      metric: { label: "potential / year", value: fmt(saving * 12) },
      action: { label: "Set a budget", href: "/budgets" },
    });
  }

  // Rule 9 — goals behind schedule / nearly complete
  const thisMonthSaved = thisSummary.net;
  for (const g of input.goals) {
    const p = goalProgress(g, now);
    if (p.status === "behind" && p.monthlyNeeded) {
      out.push({
        id: `goal-behind-${g.id ?? g.title}`,
        kind: "warning",
        topic: "goals",
        title: `"${g.title}" is behind schedule`,
        body: `You need about ${fmt(Math.round(p.monthlyNeeded))}/month to reach ${fmt(g.target)} by the target date.${
          thisMonthSaved >= p.monthlyNeeded ? ` This month's surplus so far (${fmt(Math.round(thisMonthSaved))}) would cover it.` : ""
        }`,
        priority: 58,
        metric: { label: "needed / month", value: fmt(Math.round(p.monthlyNeeded)) },
        action: { label: "Add contribution", href: "/goals" },
      });
    } else if (p.status === "overdue") {
      out.push({
        id: `goal-overdue-${g.id ?? g.title}`,
        kind: "warning",
        topic: "goals",
        title: `"${g.title}" passed its target date`,
        body: `${fmt(p.remaining)} is still remaining. Consider extending the date or increasing contributions.`,
        priority: 52,
        action: { label: "Update goal", href: "/goals" },
      });
    } else if (p.status !== "completed" && p.percent >= 85) {
      out.push({
        id: `goal-near-${g.id ?? g.title}`,
        kind: "positive",
        topic: "goals",
        title: `"${g.title}" is ${Math.round(p.percent)}% funded`,
        body: `Only ${fmt(p.remaining)} to go — you're almost there.`,
        priority: 40,
        action: { label: "Add contribution", href: "/goals" },
      });
    }
  }

  // Rule 10 — top category share
  const top = thisCats[0];
  if (top && top.share >= 35 && top.category !== "housing" && thisSummary.expense > 0) {
    out.push({
      id: `concentration-${top.category}`,
      kind: "info",
      topic: "spending",
      title: `${top.label} is ${Math.round(top.share)}% of your spending`,
      body: `A single category taking more than a third of your spending is worth a closer look.`,
      priority: 38,
      action: { label: "Open analytics", href: "/analytics" },
    });
  }

  // De-duplicate: a budget alert for a category already tells the user its spending is high,
  // so the separate "category is up" card would be noise.
  const budgetAlerted = new Set(
    out.filter((i) => i.topic === "budget" && (i.kind === "alert" || i.kind === "warning")).map((i) => i.id.replace(/^budget-(over|near|pace)-/, "")),
  );
  const seen = new Set<string>();
  return out
    .filter((i) => !(i.id.startsWith("cat-up-") && budgetAlerted.has(i.id.slice("cat-up-".length))))
    .sort((a, b) => b.priority - a.priority)
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
}
