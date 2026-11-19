import { db } from "@/lib/db";
import { withUser } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { getPreferences } from "@/server/data";

/** Full JSON export of the user's data (data portability). Password hashes are never included. */
export const GET = withUser(async (_req, { user }) => {
  const [transactions, budgets, goals, subscriptions, preferences] = await Promise.all([
    db.transaction.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    db.budget.findMany({ where: { userId: user.id }, orderBy: [{ month: "desc" }, { category: "asc" }] }),
    db.savingsGoal.findMany({ where: { userId: user.id }, include: { contributions: true } }),
    db.subscription.findMany({ where: { userId: user.id } }),
    getPreferences(user.id),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    format: "finsight-export@1",
    profile: { name: user.name, email: user.email, memberSince: user.createdAt },
    preferences,
    transactions: transactions.map((t) => ({
      date: dayKey(t.date),
      title: t.title,
      amount: fromMinor(t.amount),
      type: t.type,
      category: t.category,
      paymentMethod: t.paymentMethod,
      description: t.description,
    })),
    budgets: budgets.map((b) => ({ month: b.month, category: b.category, limit: fromMinor(b.limit), alertThreshold: b.alertThreshold })),
    goals: goals.map((g) => ({
      title: g.title,
      target: fromMinor(g.targetAmount),
      targetDate: g.targetDate ? dayKey(g.targetDate) : null,
      contributions: g.contributions.map((c) => ({ date: dayKey(c.date), amount: fromMinor(c.amount), note: c.note })),
    })),
    subscriptions: subscriptions.map((s) => ({
      name: s.name,
      amount: fromMinor(s.amount),
      billingCycle: s.billingCycle,
      category: s.category,
      status: s.status,
      nextPaymentDate: dayKey(s.nextPaymentDate),
    })),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="finsight-export-${dayKey(new Date())}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
