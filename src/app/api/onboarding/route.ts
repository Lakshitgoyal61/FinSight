import { db } from "@/lib/db";
import { json, parseBody, withUser } from "@/lib/api";
import { monthKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { onboardingSchema } from "@/lib/validators";

/** Suggested starter budgets as a share of monthly income, by budgeting style. */
const STARTER_SPLITS: Record<string, [string, number][]> = {
  "50-30-20": [["housing", 0.25], ["groceries", 0.1], ["bills", 0.08], ["transport", 0.07], ["food", 0.1], ["shopping", 0.1], ["entertainment", 0.05]],
  "zero-based": [["housing", 0.3], ["groceries", 0.12], ["bills", 0.08], ["transport", 0.08], ["food", 0.08], ["shopping", 0.06], ["entertainment", 0.04], ["health", 0.04]],
  envelope: [["groceries", 0.12], ["food", 0.08], ["shopping", 0.07], ["transport", 0.06], ["entertainment", 0.04]],
  flexible: [["food", 0.1], ["shopping", 0.1], ["entertainment", 0.05]],
};

export const POST = withUser(async (req, { user }) => {
  const data = await parseBody(req, onboardingSchema);
  const income = data.monthlyIncome ?? null;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name: data.name, onboarded: true } });
    await tx.userPreference.upsert({
      where: { userId: user.id },
      update: {
        currency: data.currency,
        monthlyIncome: income ? toMinor(income) : null,
        budgetingStyle: data.budgetingStyle,
        financialGoals: JSON.stringify(data.financialGoals),
      },
      create: {
        userId: user.id,
        currency: data.currency,
        monthlyIncome: income ? toMinor(income) : null,
        budgetingStyle: data.budgetingStyle,
        financialGoals: JSON.stringify(data.financialGoals),
      },
    });
    if (data.createStarterBudgets && income && income > 0) {
      const month = monthKey(new Date());
      for (const [category, share] of STARTER_SPLITS[data.budgetingStyle] ?? []) {
        const limit = Math.round((income * share) / 100) * 100;
        await tx.budget.upsert({
          where: { userId_category_month: { userId: user.id, category, month } },
          update: {},
          create: { userId: user.id, category, month, limit: toMinor(limit) },
        });
      }
    }
  });
  return json({ ok: true });
});
