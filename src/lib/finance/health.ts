import { clamp } from "@/lib/utils";
import type { BudgetState, GoalStatus } from "./planning";

export type HealthInput = {
  /** Average monthly income and expense over the evaluation window (typically last 3 months). */
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  /** Projected spend for the current month vs. the trailing average of previous months. */
  projectedMonthExpense: number | null;
  baselineMonthlyExpense: number;
  budgetStates: BudgetState[];
  /** Monthly-equivalent recurring subscription cost. */
  recurringMonthly: number;
  goalStatuses: GoalStatus[];
};

export type HealthComponent = {
  key: "savings" | "budgets" | "trend" | "fixed" | "goals";
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type HealthScore = {
  score: number; // 0-100
  label: "Excellent" | "Good" | "Fair" | "Needs attention" | "Getting started";
  components: HealthComponent[];
  hasEnoughData: boolean;
};

/**
 * A transparent, explainable 0-100 score. Every component shows its own points so users can
 * see exactly why the score is what it is (no black box).
 *
 *  - Savings rate ............ 30 pts  (20%+ of income saved = full marks)
 *  - Budget adherence ........ 25 pts  (share of budgets not exceeded, warnings count half)
 *  - Spending trend .......... 15 pts  (projected month spend vs trailing average)
 *  - Fixed-cost load ......... 15 pts  (subscriptions as % of income; ≤5% full, ≥25% zero)
 *  - Goal progress ........... 15 pts  (share of goals completed or on track)
 */
export function computeHealthScore(input: HealthInput): HealthScore {
  const components: HealthComponent[] = [];
  const income = input.avgMonthlyIncome;

  // Savings rate
  const rate = income > 0 ? (income - input.avgMonthlyExpense) / income : 0;
  const savingsPts = income > 0 ? clamp(rate / 0.2, 0, 1) * 30 : 0;
  components.push({
    key: "savings",
    label: "Savings rate",
    score: savingsPts,
    max: 30,
    detail:
      income > 0
        ? `You save ${Math.round(rate * 100)}% of your income on average (target: 20%).`
        : "Record your income to measure your savings rate.",
  });

  // Budget adherence
  let budgetPts: number;
  let budgetDetail: string;
  if (input.budgetStates.length === 0) {
    budgetPts = 12.5;
    budgetDetail = "No budgets this month yet — set a few to earn full points.";
  } else {
    const credit = input.budgetStates.reduce((a, s) => a + (s === "ok" ? 1 : s === "warning" ? 0.5 : 0), 0);
    budgetPts = (credit / input.budgetStates.length) * 25;
    const exceeded = input.budgetStates.filter((s) => s === "exceeded").length;
    budgetDetail =
      exceeded === 0
        ? `All ${input.budgetStates.length} budgets are within their limits.`
        : `${exceeded} of ${input.budgetStates.length} budgets are over their limit.`;
  }
  components.push({ key: "budgets", label: "Budget adherence", score: budgetPts, max: 25, detail: budgetDetail });

  // Spending trend
  let trendPts = 7.5;
  let trendDetail = "Not enough history to compare spending trends yet.";
  if (input.projectedMonthExpense !== null && input.baselineMonthlyExpense > 0) {
    const ratio = input.projectedMonthExpense / input.baselineMonthlyExpense;
    // ≤ 0.95 → full marks, ≥ 1.3 → zero
    trendPts = clamp((1.3 - ratio) / (1.3 - 0.95), 0, 1) * 15;
    const pct = Math.round((ratio - 1) * 100);
    trendDetail =
      pct > 0
        ? `This month is on pace to be ${pct}% above your recent average.`
        : `This month is on pace to be ${Math.abs(pct)}% below your recent average.`;
  }
  components.push({ key: "trend", label: "Spending trend", score: trendPts, max: 15, detail: trendDetail });

  // Fixed-cost load
  let fixedPts = 7.5;
  let fixedDetail = "Add your income to evaluate recurring costs.";
  if (income > 0) {
    const load = input.recurringMonthly / income;
    fixedPts = clamp((0.25 - load) / (0.25 - 0.05), 0, 1) * 15;
    fixedDetail = `Subscriptions use ${(load * 100).toFixed(1)}% of your monthly income.`;
  }
  components.push({ key: "fixed", label: "Recurring costs", score: fixedPts, max: 15, detail: fixedDetail });

  // Goals
  let goalPts = 7.5;
  let goalDetail = "Create a savings goal to track progress here.";
  if (input.goalStatuses.length) {
    const good = input.goalStatuses.filter((s) => s === "completed" || s === "on_track" || s === "no_deadline").length;
    goalPts = (good / input.goalStatuses.length) * 15;
    goalDetail = `${good} of ${input.goalStatuses.length} goals are completed or on track.`;
  }
  components.push({ key: "goals", label: "Goal progress", score: goalPts, max: 15, detail: goalDetail });

  const hasEnoughData = income > 0 || input.avgMonthlyExpense > 0;
  const score = Math.round(components.reduce((a, c) => a + c.score, 0));
  const label: HealthScore["label"] = !hasEnoughData
    ? "Getting started"
    : score >= 80
      ? "Excellent"
      : score >= 65
        ? "Good"
        : score >= 45
          ? "Fair"
          : "Needs attention";

  return {
    score: hasEnoughData ? score : 0,
    label,
    components: components.map((c) => ({ ...c, score: Math.round(c.score * 10) / 10 })),
    hasEnoughData,
  };
}
