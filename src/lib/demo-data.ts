import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { addDays, addMonthsUTC, dateFromKey, dayKey, daysInMonthUTC, monthKey, startOfMonthUTC } from "./dates";

/**
 * Generates a realistic, deterministic demo dataset for a user, relative to `now`, so the demo
 * account always looks "current" no matter when the project is evaluated.
 * Everything is written to the database — the app never reads from these arrays directly.
 */

// Small seeded PRNG (mulberry32) so the demo is reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TxnSeed = {
  title: string;
  amount: number; // major units
  type: "INCOME" | "EXPENSE";
  category: string;
  date: Date;
  paymentMethod: string;
  description?: string;
  subscriptionId?: string;
};

const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)]!;
const between = (r: () => number, min: number, max: number, step = 10) =>
  Math.round((min + r() * (max - min)) / step) * step;

const SUBSCRIPTIONS = [
  { key: "netflix", name: "Netflix", amount: 649, cycle: "MONTHLY", category: "entertainment", day: 21, method: "Card" },
  { key: "spotify", name: "Spotify Premium", amount: 119, cycle: "MONTHLY", category: "entertainment", day: 24, method: "UPI" },
  { key: "youtube", name: "YouTube Premium", amount: 129, cycle: "MONTHLY", category: "entertainment", day: 9, method: "UPI" },
  { key: "icloud", name: "iCloud+ 200GB", amount: 219, cycle: "MONTHLY", category: "bills", day: 26, method: "Card" },
  { key: "cult", name: "Cult.fit Pro", amount: 1299, cycle: "MONTHLY", category: "health", day: 12, method: "Card" },
  { key: "prime", name: "Amazon Prime", amount: 1499, cycle: "YEARLY", category: "shopping", day: 4, method: "Card" },
] as const;

export async function seedDemoData(db: PrismaClient, userId: string, now = new Date()) {
  const r = rng(20261119);
  const today = dayKey(now);
  const currentMonthStart = startOfMonthUTC(now);
  const months = Array.from({ length: 7 }, (_, i) => addMonthsUTC(currentMonthStart, i - 6));

  // Wipe existing financial data for this user (used by "Reset demo data").
  await db.$transaction([
    db.transaction.deleteMany({ where: { userId } }),
    db.goalContribution.deleteMany({ where: { userId } }),
    db.savingsGoal.deleteMany({ where: { userId } }),
    db.budget.deleteMany({ where: { userId } }),
    db.subscription.deleteMany({ where: { userId } }),
  ]);

  // ---------------- Subscriptions ----------------
  const subIds: Record<string, string> = {};
  const subRows: { id: string; userId: string; name: string; amount: number; billingCycle: string; category: string; nextPaymentDate: Date; paymentMethod: string; status: string; startDate: Date }[] = SUBSCRIPTIONS.map((s) => {
    const id = randomUUID();
    subIds[s.key] = id;
    let next: Date;
    if (s.cycle === "YEARLY") {
      next = dateFromKey(`${now.getUTCFullYear() + (now.getUTCMonth() >= 2 ? 1 : 0)}-03-0${s.day}`);
    } else {
      const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(s.day, daysInMonthUTC(now)), 12));
      next = dayKey(thisMonth) >= today ? thisMonth : addMonthsUTC(thisMonth, 1);
    }
    return {
      id,
      userId,
      name: s.name,
      amount: s.amount * 100,
      billingCycle: s.cycle,
      category: s.category,
      nextPaymentDate: next,
      paymentMethod: s.method,
      status: "ACTIVE",
      startDate: months[0]!,
    };
  });
  const hotstarId = randomUUID();
  subRows.push({
    id: hotstarId,
    userId,
    name: "Disney+ Hotstar",
    amount: 299 * 100,
    billingCycle: "MONTHLY",
    category: "entertainment",
    nextPaymentDate: addMonthsUTC(months[3]!, 0),
    paymentMethod: "UPI",
    status: "CANCELLED",
    startDate: months[0]!,
  });
  await db.subscription.createMany({
    data: subRows.map((s) => ({ ...s, cancelledAt: s.status === "CANCELLED" ? months[3] : null })),
  });

  // ---------------- Transactions ----------------
  const txns: TxnSeed[] = [];
  const on = (month: Date, day: number) =>
    new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(day, daysInMonthUTC(month)), 12));

  months.forEach((m, mi) => {
    const isCurrent = mi === months.length - 1;
    const dim = daysInMonthUTC(m);
    const push = (t: TxnSeed) => {
      if (dayKey(t.date) <= today) txns.push(t);
    };

    // Income
    push({ title: "Nimbus Technologies — Salary", amount: 68000, type: "INCOME", category: "salary", date: on(m, 1), paymentMethod: "Bank Transfer", description: "Monthly salary credit" });
    if (mi % 2 === 0 || r() > 0.5) {
      push({ title: pick(r, ["Upwork — UI Design Project", "Fiverr — Landing Page", "Toptal — Dashboard Audit"]), amount: between(r, 6000, 18000, 500), type: "INCOME", category: "freelance", date: on(m, 8 + Math.floor(r() * 15)), paymentMethod: "Bank Transfer" });
    }
    if (mi % 3 === 1) push({ title: "Zerodha — Dividend", amount: between(r, 600, 2400, 50), type: "INCOME", category: "investments", date: on(m, 18), paymentMethod: "Bank Transfer" });
    if (r() > 0.7) push({ title: "Amazon Refund", amount: between(r, 300, 1800, 10), type: "INCOME", category: "refunds", date: on(m, 10 + Math.floor(r() * 15)), paymentMethod: "Card" });

    // Fixed costs
    push({ title: "Rent — Koramangala Apartment", amount: 18000, type: "EXPENSE", category: "housing", date: on(m, 3), paymentMethod: "Bank Transfer" });
    push({ title: "BESCOM Electricity", amount: between(r, 1100, 2300), type: "EXPENSE", category: "bills", date: on(m, 6), paymentMethod: "UPI" });
    push({ title: "Airtel Postpaid", amount: 599, type: "EXPENSE", category: "bills", date: on(m, 7), paymentMethod: "UPI" });
    push({ title: "ACT Fibernet", amount: 1049, type: "EXPENSE", category: "bills", date: on(m, 10), paymentMethod: "Card" });

    // Subscriptions (linked to the subscription records)
    for (const s of SUBSCRIPTIONS) {
      if (s.cycle === "YEARLY") continue;
      push({ title: s.name, amount: s.amount, type: "EXPENSE", category: s.category, date: on(m, s.day), paymentMethod: s.method, subscriptionId: subIds[s.key] });
    }
    if (mi <= 2) push({ title: "Disney+ Hotstar", amount: 299, type: "EXPENSE", category: "entertainment", date: on(m, 15), paymentMethod: "UPI", subscriptionId: hotstarId });
    if (m.getUTCMonth() === 2) push({ title: "Amazon Prime", amount: 1499, type: "EXPENSE", category: "shopping", date: on(m, 4), paymentMethod: "Card", subscriptionId: subIds.prime });

    // Groceries — weekly
    for (let d = 2 + Math.floor(r() * 3); d <= dim; d += 6 + Math.floor(r() * 3)) {
      push({ title: pick(r, ["BigBasket", "Blinkit", "DMart", "Zepto", "Nature's Basket"]), amount: between(r, 650, 2600), type: "EXPENSE", category: "groceries", date: on(m, d), paymentMethod: pick(r, ["UPI", "Card"]) });
    }

    // Food & dining — heavier on weekends, and noticeably higher in the current month
    const foodCount = isCurrent ? 16 : 9 + Math.floor(r() * 4);
    for (let i = 0; i < foodCount; i++) {
      let day = 1 + Math.floor(r() * dim);
      const date = on(m, day);
      const dow = date.getUTCDay();
      if (dow !== 0 && dow !== 6 && r() > 0.55) {
        day = Math.min(dim, day + (6 - dow));
      }
      push({ title: pick(r, ["Zomato", "Swiggy", "Starbucks", "Third Wave Coffee", "Truffles", "Meghana Foods", "Domino's"]), amount: between(r, 180, isCurrent ? 980 : 760), type: "EXPENSE", category: "food", date: on(m, day), paymentMethod: "UPI" });
    }

    // Transport
    for (let i = 0; i < 7 + Math.floor(r() * 4); i++) {
      push({ title: pick(r, ["Uber", "Ola", "Rapido", "Namma Metro Recharge"]), amount: between(r, 90, 480), type: "EXPENSE", category: "transport", date: on(m, 1 + Math.floor(r() * dim)), paymentMethod: "UPI" });
    }
    if (r() > 0.4) push({ title: "Indian Oil — Fuel", amount: between(r, 800, 1600), type: "EXPENSE", category: "transport", date: on(m, 14), paymentMethod: "Card" });

    // Shopping — the current month is higher so the insights engine has something to flag
    const shopCount = isCurrent ? 4 : 2 + Math.floor(r() * 2);
    for (let i = 0; i < shopCount; i++) {
      push({ title: pick(r, ["Amazon", "Myntra", "Flipkart", "Uniqlo", "Decathlon", "Croma"]), amount: between(r, 499, isCurrent ? 3400 : 2600), type: "EXPENSE", category: "shopping", date: on(m, 2 + Math.floor(r() * (dim - 2))), paymentMethod: "Card" });
    }

    // Entertainment
    if (r() > 0.3) push({ title: pick(r, ["PVR Cinemas", "BookMyShow — Concert", "Smaaash", "Steam Games"]), amount: between(r, 350, 1800), type: "EXPENSE", category: "entertainment", date: on(m, 5 + Math.floor(r() * 20)), paymentMethod: "Card" });

    // Health, personal, education, gifts
    if (r() > 0.4) push({ title: "Apollo Pharmacy", amount: between(r, 180, 900), type: "EXPENSE", category: "health", date: on(m, 1 + Math.floor(r() * dim)), paymentMethod: "UPI" });
    if (r() > 0.5) push({ title: pick(r, ["Toni & Guy", "Urban Company Salon", "Nykaa"]), amount: between(r, 400, 1400), type: "EXPENSE", category: "personal", date: on(m, 1 + Math.floor(r() * dim)), paymentMethod: "UPI" });
    if (mi === 1 || mi === 4) push({ title: pick(r, ["Coursera Plus", "Udemy — Next.js Course", "O'Reilly Books"]), amount: between(r, 499, 3200), type: "EXPENSE", category: "education", date: on(m, 16), paymentMethod: "Card" });
    if (mi === 2) push({ title: "Birthday gift — Archies", amount: 1850, type: "EXPENSE", category: "gifts", date: on(m, 20), paymentMethod: "UPI" });

    // One trip
    if (mi === 3) {
      push({ title: "IndiGo — BLR to GOI", amount: 7840, type: "EXPENSE", category: "travel", date: on(m, 11), paymentMethod: "Card", description: "Goa long weekend" });
      push({ title: "Zostel Goa", amount: 5600, type: "EXPENSE", category: "travel", date: on(m, 13), paymentMethod: "Card", description: "3 nights" });
    }
  });

  // A one-off unusually large purchase in the last 30 days (for the anomaly detector)
  const big = addDays(now, -4);
  txns.push({ title: "Croma — Noise-cancelling Headphones", amount: 14990, type: "EXPENSE", category: "shopping", date: new Date(`${dayKey(big)}T12:00:00.000Z`), paymentMethod: "Card", description: "Sony WH-1000XM5" });

  await db.transaction.createMany({
    data: txns.map((t) => ({
      userId,
      title: t.title,
      amount: Math.round(t.amount * 100),
      type: t.type,
      category: t.category,
      date: t.date,
      paymentMethod: t.paymentMethod,
      description: t.description ?? null,
      subscriptionId: t.subscriptionId ?? null,
    })),
  });

  // ---------------- Budgets (current + 2 previous months) ----------------
  const budgetPlan: [string, number][] = [
    ["food", 6500],
    ["groceries", 8000],
    ["shopping", 9000],
    ["transport", 3500],
    ["entertainment", 3000],
    ["bills", 5500],
    ["health", 2500],
  ];
  const budgetRows = months.slice(-3).flatMap((m) =>
    budgetPlan.map(([category, limit]) => ({
      userId,
      category,
      month: monthKey(m),
      limit: limit * 100,
      alertThreshold: 80,
    })),
  );
  await db.budget.createMany({ data: budgetRows });

  // ---------------- Savings goals ----------------
  const goals = [
    // Contributions total ≈ ₹1.6L over 7 months, comfortably below cumulative net income.
    { title: "MacBook Air M4", target: 120000, monthly: 9000, start: 0, icon: "laptop", color: "violet", monthsAhead: 5 },
    { title: "Emergency Fund", target: 100000, monthly: 7000, start: 0, icon: "shield", color: "teal", monthsAhead: 8 },
    { title: "Europe Trip", target: 120000, monthly: 2500, start: 0, icon: "plane", color: "blue", monthsAhead: 4 },
    { title: "iPhone Upgrade", target: 30000, monthly: 5500, start: 0, icon: "smartphone", color: "amber", monthsAhead: -1 },
  ];
  for (const g of goals) {
    const goalId = randomUUID();
    const contributions: { amount: number; date: Date; note: string | null }[] = [];
    if (g.start) contributions.push({ amount: g.start, date: on(months[0]!, 2), note: "Opening balance" });
    let saved = g.start;
    for (const m of months) {
      if (saved >= g.target) break;
      const d = on(m, 2);
      if (dayKey(d) > today) continue;
      const amt = Math.min(g.monthly + between(r, -1000, 1000, 500), g.target - saved);
      saved += amt;
      contributions.push({ amount: amt, date: d, note: "Monthly transfer" });
    }
    const completed = saved >= g.target;
    await db.savingsGoal.create({
      data: {
        id: goalId,
        userId,
        title: g.title,
        targetAmount: g.target * 100,
        targetDate: addMonthsUTC(on(currentMonthStart, 28), g.monthsAhead),
        icon: g.icon,
        color: g.color,
        createdAt: months[0],
        completedAt: completed ? contributions[contributions.length - 1]!.date : null,
        contributions: {
          create: contributions.map((c) => ({ userId, amount: Math.round(c.amount * 100), date: c.date, note: c.note })),
        },
      },
    });
  }

  return { transactions: txns.length, budgets: budgetRows.length, goals: goals.length, subscriptions: subRows.length };
}
