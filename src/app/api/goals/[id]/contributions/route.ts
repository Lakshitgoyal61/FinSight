import { db } from "@/lib/db";
import { ApiError, json, notFound, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { fromMinor, toMinor } from "@/lib/money";
import { contributionSchema } from "@/lib/validators";
import { syncGoalCompletion } from "@/server/goals";

type Params = { id: string };

export const POST = withUser<Params>(async (req, { user, params }) => {
  const goal = await db.savingsGoal.findFirst({ where: { id: params.id, userId: user.id } });
  if (!goal) throw notFound("Goal");
  const data = await parseBody(req, contributionSchema);
  const minor = toMinor(data.amount);

  if (data.kind === "withdrawal") {
    const agg = await db.goalContribution.aggregate({ where: { goalId: goal.id }, _sum: { amount: true } });
    const saved = agg._sum.amount ?? 0;
    if (minor > saved) {
      throw new ApiError(422, "You can't withdraw more than you've saved", {
        amount: `Only ${fromMinor(saved).toLocaleString("en-IN")} is available to withdraw`,
      });
    }
  }

  await db.goalContribution.create({
    data: {
      goalId: goal.id,
      userId: user.id,
      amount: data.kind === "withdrawal" ? -minor : minor,
      note: data.note,
      date: data.date ? dateFromKey(data.date) : new Date(),
    },
  });
  const justCompleted = await syncGoalCompletion(goal.id);
  return json({ ok: true, completed: justCompleted }, { status: 201 });
});
