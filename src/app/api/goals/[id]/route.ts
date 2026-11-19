import { db } from "@/lib/db";
import { json, notFound, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { goalUpdateSchema } from "@/lib/validators";
import { syncGoalCompletion } from "@/server/goals";

type Params = { id: string };

export const PATCH = withUser<Params>(async (req, { user, params }) => {
  const goal = await db.savingsGoal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!goal) throw notFound("Goal");
  const data = await parseBody(req, goalUpdateSchema);
  await db.savingsGoal.update({
    where: { id: goal.id },
    data: {
      title: data.title,
      targetAmount: toMinor(data.targetAmount),
      targetDate: data.targetDate ? dateFromKey(data.targetDate) : null,
      icon: data.icon,
      color: data.color,
    },
  });
  await syncGoalCompletion(goal.id);
  return json({ ok: true });
});

export const DELETE = withUser<Params>(async (_req, { user, params }) => {
  // Contributions are removed by the ON DELETE CASCADE relation.
  const result = await db.savingsGoal.deleteMany({ where: { id: params.id, userId: user.id } });
  if (!result.count) throw notFound("Goal");
  return json({ ok: true });
});
