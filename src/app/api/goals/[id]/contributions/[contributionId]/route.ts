import { db } from "@/lib/db";
import { json, notFound, withUser } from "@/lib/api";
import { syncGoalCompletion } from "@/server/goals";

type Params = { id: string; contributionId: string };

export const DELETE = withUser<Params>(async (_req, { user, params }) => {
  const result = await db.goalContribution.deleteMany({
    where: { id: params.contributionId, goalId: params.id, userId: user.id },
  });
  if (!result.count) throw notFound("Contribution");
  await syncGoalCompletion(params.id);
  return json({ ok: true });
});
