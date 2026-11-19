import { db } from "@/lib/db";
import { ApiError, json, parseBody, withUser } from "@/lib/api";
import { copyBudgetsSchema } from "@/lib/validators";

/** Copy all budgets from one month to another, skipping categories that already exist. */
export const POST = withUser(async (req, { user }) => {
  const { from, to } = await parseBody(req, copyBudgetsSchema);
  if (from === to) throw new ApiError(422, "Choose two different months");
  const [source, existing] = await Promise.all([
    db.budget.findMany({ where: { userId: user.id, month: from } }),
    db.budget.findMany({ where: { userId: user.id, month: to }, select: { category: true } }),
  ]);
  if (!source.length) throw new ApiError(404, "There are no budgets in the previous month to copy");
  const taken = new Set(existing.map((b) => b.category));
  const toCreate = source.filter((b) => !taken.has(b.category));
  if (toCreate.length) {
    await db.budget.createMany({
      data: toCreate.map((b) => ({
        userId: user.id,
        category: b.category,
        month: to,
        limit: b.limit,
        alertThreshold: b.alertThreshold,
      })),
    });
  }
  return json({ copied: toCreate.length, skipped: source.length - toCreate.length });
});
