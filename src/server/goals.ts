import "server-only";
import { db } from "@/lib/db";

/** Keep `completedAt` in sync with the sum of contributions. Returns whether the goal just completed. */
export async function syncGoalCompletion(goalId: string): Promise<boolean> {
  const goal = await db.savingsGoal.findUnique({
    where: { id: goalId },
    select: { targetAmount: true, completedAt: true },
  });
  if (!goal) return false;
  const agg = await db.goalContribution.aggregate({ where: { goalId }, _sum: { amount: true } });
  const saved = agg._sum.amount ?? 0;
  const complete = saved >= goal.targetAmount;
  if (complete && !goal.completedAt) {
    await db.savingsGoal.update({ where: { id: goalId }, data: { completedAt: new Date() } });
    return true;
  }
  if (!complete && goal.completedAt) {
    await db.savingsGoal.update({ where: { id: goalId }, data: { completedAt: null } });
  }
  return false;
}
