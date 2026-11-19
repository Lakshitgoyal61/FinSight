/** Plain-number (major unit) shapes used by the pure finance modules. */

export type Txn = {
  id: string;
  title: string;
  amount: number; // major units, positive
  type: "INCOME" | "EXPENSE";
  category: string;
  date: Date;
  paymentMethod?: string;
};

export type BudgetInput = {
  id?: string;
  category: string;
  limit: number;
  alertThreshold: number; // percent
  spent: number;
};

export type SubscriptionInput = {
  id?: string;
  name: string;
  amount: number;
  billingCycle: "MONTHLY" | "YEARLY" | string;
  category: string;
  nextPaymentDate: Date;
  status: "ACTIVE" | "CANCELLED" | string;
};

export type GoalInput = {
  id?: string;
  title: string;
  target: number;
  saved: number;
  targetDate: Date | null;
  createdAt: Date;
};
