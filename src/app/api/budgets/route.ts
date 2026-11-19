import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, withUser } from "@/lib/api";
import { monthKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { budgetSchema, monthKeySchema } from "@/lib/validators";
import { getBudgets } from "@/server/data";

export const GET = withUser(async (req, { user }) => {
  const { month } = parseQuery(req, z.object({ month: monthKeySchema.optional() }));
  return json(await getBudgets(user.id, month ?? monthKey(new Date())));
});

export const POST = withUser(async (req, { user }) => {
  const data = await parseBody(req, budgetSchema);
  const existing = await db.budget.findUnique({
    where: { userId_category_month: { userId: user.id, category: data.category, month: data.month } },
  });
  if (existing) {
    throw new ApiError(409, "A budget for this category already exists this month", {
      category: "You already have a budget for this category this month. Edit it instead.",
    });
  }
  const budget = await db.budget.create({
    data: {
      userId: user.id,
      category: data.category,
      month: data.month,
      limit: toMinor(data.limit),
      alertThreshold: data.alertThreshold,
    },
  });
  return json({ budget: { id: budget.id } }, { status: 201 });
});
