import { db } from "@/lib/db";
import { json, parseBody, withUser } from "@/lib/api";
import { toMinor } from "@/lib/money";
import { preferencesSchema } from "@/lib/validators";
import { getPreferences } from "@/server/data";

export const GET = withUser(async (_req, { user }) => json({ preferences: await getPreferences(user.id) }));

export const PATCH = withUser(async (req, { user }) => {
  const data = await parseBody(req, preferencesSchema);
  const { financialGoals, monthlyIncome, ...rest } = data;
  const update = {
    ...rest,
    ...(financialGoals !== undefined ? { financialGoals: JSON.stringify(financialGoals) } : {}),
    ...(monthlyIncome !== undefined ? { monthlyIncome: monthlyIncome === null ? null : toMinor(monthlyIncome) } : {}),
  };
  await db.userPreference.upsert({
    where: { userId: user.id },
    update,
    create: { userId: user.id, ...update },
  });
  return json({ preferences: await getPreferences(user.id) });
});
