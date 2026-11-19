import { db } from "@/lib/db";
import { json, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { goalSchema } from "@/lib/validators";
import { getGoals } from "@/server/data";
import { syncGoalCompletion } from "@/server/goals";

export const GET = withUser(async (_req, { user }) => {
  return json({ goals: await getGoals(user.id) });
});

export const POST = withUser(async (req, { user }) => {
  const data = await parseBody(req, goalSchema);
  const goal = await db.savingsGoal.create({
    data: {
      userId: user.id,
      title: data.title,
      targetAmount: toMinor(data.targetAmount),
      targetDate: data.targetDate ? dateFromKey(data.targetDate) : null,
      icon: data.icon,
      color: data.color,
      ...(data.initialAmount && data.initialAmount > 0
        ? { contributions: { create: { userId: user.id, amount: toMinor(data.initialAmount), note: "Starting amount" } } }
        : {}),
    },
  });
  await syncGoalCompletion(goal.id);
  return json({ goal: { id: goal.id } }, { status: 201 });
});
