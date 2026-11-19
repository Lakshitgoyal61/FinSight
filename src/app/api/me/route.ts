import { db } from "@/lib/db";
import { json, withUser } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { getPreferences } from "@/server/data";

export const GET = withUser(async (_req, { user }) => {
  const [preferences, transactions, budgets, goals, subscriptions, first, sessions] = await Promise.all([
    getPreferences(user.id),
    db.transaction.count({ where: { userId: user.id } }),
    db.budget.count({ where: { userId: user.id } }),
    db.savingsGoal.count({ where: { userId: user.id } }),
    db.subscription.count({ where: { userId: user.id, status: "ACTIVE" } }),
    db.transaction.findFirst({ where: { userId: user.id }, orderBy: { date: "asc" }, select: { date: true } }),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
  ]);
  return json({
    user: { ...user, createdAt: user.createdAt.toISOString() },
    preferences,
    stats: { transactions, budgets, goals, subscriptions, trackingSince: first ? dayKey(first.date) : null, activeSessions: sessions },
  });
});
