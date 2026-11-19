/**
 * Domain taxonomy for FinSight. These are configuration values (labels, icons, colors),
 * not user data — all user data lives in the database.
 */

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * `slot` maps to the validated categorical chart palette (--cat-1 … --cat-8 in globals.css).
 * Identity is never carried by color alone: every category also has an icon and a label.
 */
export const EXPENSE_CATEGORIES = [
  { id: "food", label: "Food & Dining", icon: "utensils", slot: 2 },
  { id: "groceries", label: "Groceries", icon: "shopping-basket", slot: 6 },
  { id: "shopping", label: "Shopping", icon: "shopping-bag", slot: 7 },
  { id: "transport", label: "Transport", icon: "car", slot: 1 },
  { id: "bills", label: "Bills & Utilities", icon: "receipt", slot: 4 },
  { id: "housing", label: "Rent & Housing", icon: "home", slot: 3 },
  { id: "entertainment", label: "Entertainment", icon: "clapperboard", slot: 5 },
  { id: "health", label: "Health & Fitness", icon: "heart-pulse", slot: 8 },
  { id: "education", label: "Education", icon: "graduation-cap", slot: 1 },
  { id: "travel", label: "Travel", icon: "plane", slot: 3 },
  { id: "subscriptions", label: "Subscriptions", icon: "repeat", slot: 7 },
  { id: "personal", label: "Personal Care", icon: "sparkles", slot: 5 },
  { id: "gifts", label: "Gifts & Donations", icon: "gift", slot: 8 },
  { id: "other", label: "Other", icon: "circle-ellipsis", slot: 0 },
] as const;

export const INCOME_CATEGORIES = [
  { id: "salary", label: "Salary", icon: "briefcase", slot: 3 },
  { id: "freelance", label: "Freelance", icon: "laptop", slot: 1 },
  { id: "investments", label: "Investments", icon: "trending-up", slot: 6 },
  { id: "refunds", label: "Refunds", icon: "rotate-ccw", slot: 4 },
  { id: "gifts_received", label: "Gifts Received", icon: "gift", slot: 5 },
  { id: "other_income", label: "Other Income", icon: "circle-ellipsis", slot: 0 },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];
export type IncomeCategoryId = (typeof INCOME_CATEGORIES)[number]["id"];
export type CategoryId = ExpenseCategoryId | IncomeCategoryId;

export const EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id) as [ExpenseCategoryId, ...ExpenseCategoryId[]];
export const INCOME_CATEGORY_IDS = INCOME_CATEGORIES.map((c) => c.id) as [IncomeCategoryId, ...IncomeCategoryId[]];
export const ALL_CATEGORY_IDS = [...EXPENSE_CATEGORY_IDS, ...INCOME_CATEGORY_IDS] as [CategoryId, ...CategoryId[]];

export type CategoryMeta = { id: string; label: string; icon: string; slot: number };

const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.id, c]),
);

export function getCategory(id: string): CategoryMeta {
  return CATEGORY_MAP[id] ?? { id, label: id, icon: "circle-ellipsis", slot: 0 };
}

export function categoryColor(id: string): string {
  const slot = getCategory(id).slot;
  return slot === 0 ? "var(--cat-other)" : `var(--cat-${slot})`;
}

export function isCategoryForType(category: string, type: TransactionType): boolean {
  return type === "INCOME"
    ? (INCOME_CATEGORY_IDS as readonly string[]).includes(category)
    : (EXPENSE_CATEGORY_IDS as readonly string[]).includes(category);
}

/** Categories considered discretionary — used by the insights engine for savings suggestions. */
export const DISCRETIONARY_CATEGORIES: readonly string[] = [
  "food",
  "shopping",
  "entertainment",
  "travel",
  "personal",
  "subscriptions",
];

export const PAYMENT_METHODS = ["UPI", "Card", "Cash", "Net Banking", "Wallet", "Bank Transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "de-DE" },
  { code: "GBP", label: "British Pound", symbol: "£", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham", symbol: "AED", locale: "en-AE" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export const BUDGETING_STYLES = [
  {
    id: "50-30-20",
    label: "50 / 30 / 20",
    description: "50% needs, 30% wants, 20% savings. A balanced default for most people.",
  },
  {
    id: "zero-based",
    label: "Zero-based",
    description: "Give every rupee a job until income minus planned spending equals zero.",
  },
  {
    id: "envelope",
    label: "Envelope",
    description: "Strict per-category limits. When an envelope is empty, spending stops.",
  },
  {
    id: "flexible",
    label: "Flexible",
    description: "Track freely and set limits only on the categories that matter to you.",
  },
] as const;
export type BudgetingStyle = (typeof BUDGETING_STYLES)[number]["id"];
export const BUDGETING_STYLE_IDS = BUDGETING_STYLES.map((s) => s.id) as [BudgetingStyle, ...BudgetingStyle[]];

export const FINANCIAL_GOAL_OPTIONS = [
  { id: "save_more", label: "Save more each month", icon: "piggy-bank" },
  { id: "control_spending", label: "Control my spending", icon: "gauge" },
  { id: "emergency_fund", label: "Build an emergency fund", icon: "shield" },
  { id: "pay_debt", label: "Pay off debt", icon: "credit-card" },
  { id: "big_purchase", label: "Plan a big purchase", icon: "laptop" },
  { id: "invest", label: "Start investing", icon: "trending-up" },
] as const;
export const FINANCIAL_GOAL_IDS = FINANCIAL_GOAL_OPTIONS.map((g) => g.id) as [string, ...string[]];

export const GOAL_ICONS = ["target", "laptop", "plane", "shield", "smartphone", "car", "home", "graduation-cap", "gift", "heart"] as const;
export const GOAL_COLORS = ["violet", "blue", "teal", "amber", "pink", "emerald"] as const;
export type GoalColor = (typeof GOAL_COLORS)[number];

export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELLED"] as const;

export const THEMES = ["dark", "light", "system"] as const;
