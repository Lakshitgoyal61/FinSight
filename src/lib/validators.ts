import { z } from "zod";
import {
  ALL_CATEGORY_IDS,
  BILLING_CYCLES,
  BUDGETING_STYLE_IDS,
  CURRENCY_CODES,
  EXPENSE_CATEGORY_IDS,
  FINANCIAL_GOAL_IDS,
  GOAL_COLORS,
  GOAL_ICONS,
  PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  THEMES,
  TRANSACTION_TYPES,
  isCategoryForType,
} from "./constants";

const MAX_AMOUNT = 10_000_000; // ₹1 crore per record — guards against typos and int overflow

const dateKey = z
  .string({ required_error: "Date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()), "Enter a valid date");

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .positive(`${label} must be greater than 0`)
    .max(MAX_AMOUNT, `${label} looks too large`)
    .transform((v) => Math.round(v * 100) / 100);

const trimmed = (label: string, max: number, min = 1) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// ---------- Auth ----------

export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const signupSchema = z.object({
  name: trimmed("Name", 60, 2),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

// ---------- Transactions ----------

export const transactionSchema = z
  .object({
    title: trimmed("Title", 80),
    amount: money("Amount"),
    type: z.enum(TRANSACTION_TYPES, { errorMap: () => ({ message: "Choose income or expense" }) }),
    category: z.enum(ALL_CATEGORY_IDS, { errorMap: () => ({ message: "Choose a category" }) }),
    date: dateKey,
    paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Choose a payment method" }) }),
    description: optionalText(500),
  })
  .refine((d) => isCategoryForType(d.category, d.type), {
    message: "This category doesn't match the transaction type",
    path: ["category"],
  })
  .refine((d) => new Date(`${d.date}T12:00:00Z`).getTime() <= Date.now() + 366 * 86_400_000, {
    message: "Date is too far in the future",
    path: ["date"],
  });
export type TransactionInput = z.infer<typeof transactionSchema>;

export const transactionQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  category: z.string().optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
  sort: z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"]).default("date_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(15),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one transaction").max(500),
});

// ---------- Budgets ----------

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM");

export const budgetSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_IDS, { errorMap: () => ({ message: "Choose an expense category" }) }),
  month: monthKeySchema,
  limit: money("Limit"),
  alertThreshold: z.coerce.number().int().min(50, "Minimum is 50%").max(100, "Maximum is 100%").default(80),
});

export const budgetUpdateSchema = budgetSchema.pick({ limit: true, alertThreshold: true });

export const copyBudgetsSchema = z.object({ from: monthKeySchema, to: monthKeySchema });

// ---------- Savings goals ----------

export const goalSchema = z.object({
  title: trimmed("Goal name", 60),
  targetAmount: money("Target amount"),
  targetDate: dateKey.optional().nullable().or(z.literal("").transform(() => null)),
  icon: z.enum(GOAL_ICONS).default("target"),
  color: z.enum(GOAL_COLORS).default("violet"),
  initialAmount: z.coerce.number().min(0, "Cannot be negative").max(MAX_AMOUNT).optional().default(0),
});

export const goalUpdateSchema = goalSchema.omit({ initialAmount: true });

export const contributionSchema = z.object({
  amount: money("Amount"),
  kind: z.enum(["deposit", "withdrawal"]).default("deposit"),
  note: optionalText(120),
  date: dateKey.optional(),
});

// ---------- Subscriptions ----------

export const subscriptionSchema = z.object({
  name: trimmed("Name", 60),
  amount: money("Amount"),
  billingCycle: z.enum(BILLING_CYCLES, { errorMap: () => ({ message: "Choose a billing cycle" }) }),
  category: z.enum(EXPENSE_CATEGORY_IDS, { errorMap: () => ({ message: "Choose a category" }) }),
  nextPaymentDate: dateKey,
  paymentMethod: z.enum(PAYMENT_METHODS).default("Card"),
  notes: optionalText(200),
});

export const subscriptionPatchSchema = subscriptionSchema.partial().extend({
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
});

// ---------- Profile & preferences ----------

export const profileSchema = z.object({
  name: trimmed("Name", 60, 2),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
});

export const preferencesSchema = z
  .object({
    currency: z.enum(CURRENCY_CODES),
    theme: z.enum(THEMES),
    monthlyIncome: z.coerce.number().min(0).max(MAX_AMOUNT).nullable(),
    budgetingStyle: z.enum(BUDGETING_STYLE_IDS),
    financialGoals: z.array(z.enum(FINANCIAL_GOAL_IDS as [string, ...string[]])).max(6),
    notifyBudgetAlerts: z.boolean(),
    notifySubscriptionReminders: z.boolean(),
    notifyGoalMilestones: z.boolean(),
    notifyWeeklySummary: z.boolean(),
    reminderDays: z.coerce.number().int().min(1).max(14),
  })
  .partial();

export const onboardingSchema = z.object({
  name: trimmed("Name", 60, 2),
  currency: z.enum(CURRENCY_CODES).default("INR"),
  monthlyIncome: z.coerce.number().min(0).max(MAX_AMOUNT).nullable().optional(),
  financialGoals: z.array(z.enum(FINANCIAL_GOAL_IDS as [string, ...string[]])).max(6).default([]),
  budgetingStyle: z.enum(BUDGETING_STYLE_IDS).default("flexible"),
  createStarterBudgets: z.boolean().default(false),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type "DELETE" to confirm' }) }),
});

/** Flatten a ZodError into { field: message } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
