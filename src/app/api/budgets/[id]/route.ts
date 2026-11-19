import { db } from "@/lib/db";
import { json, notFound, parseBody, withUser } from "@/lib/api";
import { toMinor } from "@/lib/money";
import { budgetUpdateSchema } from "@/lib/validators";

type Params = { id: string };

export const PATCH = withUser<Params>(async (req, { user, params }) => {
  const budget = await db.budget.findFirst({ where: { id: params.id, userId: user.id } });
  if (!budget) throw notFound("Budget");
  const data = await parseBody(req, budgetUpdateSchema);
  await db.budget.update({
    where: { id: budget.id },
    data: { limit: toMinor(data.limit), alertThreshold: data.alertThreshold },
  });
  return json({ ok: true });
});

export const DELETE = withUser<Params>(async (_req, { user, params }) => {
  const result = await db.budget.deleteMany({ where: { id: params.id, userId: user.id } });
  if (!result.count) throw notFound("Budget");
  return json({ ok: true });
});
