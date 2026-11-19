import { db } from "@/lib/db";
import { ApiError, json, notFound, withUser } from "@/lib/api";
import { dateFromKey, dayKey } from "@/lib/dates";
import { advancePaymentDate } from "@/lib/finance/planning";

/**
 * Mark the current billing cycle as paid: records an expense transaction linked to the
 * subscription and advances the next payment date by one cycle — atomically.
 */
export const POST = withUser<{ id: string }>(async (_req, { user, params }) => {
  const sub = await db.subscription.findFirst({ where: { id: params.id, userId: user.id } });
  if (!sub) throw notFound("Subscription");
  if (sub.status !== "ACTIVE") throw new ApiError(422, "Reactivate this subscription before recording a payment");

  const now = new Date();
  const due = sub.nextPaymentDate;
  // Payments are recorded on the due date (even if overdue), but never in the future.
  const paidOn = dayKey(due) > dayKey(now) ? dateFromKey(dayKey(now)) : due;
  const next = advancePaymentDate(due, sub.billingCycle);

  await db.$transaction([
    db.transaction.create({
      data: {
        userId: user.id,
        title: sub.name,
        amount: sub.amount,
        type: "EXPENSE",
        category: sub.category,
        date: paidOn,
        paymentMethod: sub.paymentMethod,
        description: `${sub.billingCycle === "YEARLY" ? "Yearly" : "Monthly"} subscription payment`,
        subscriptionId: sub.id,
      },
    }),
    db.subscription.update({ where: { id: sub.id }, data: { nextPaymentDate: next } }),
  ]);
  return json({ ok: true, nextPaymentDate: dayKey(next) });
});
