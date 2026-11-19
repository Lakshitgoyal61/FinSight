import { db } from "@/lib/db";
import { json, notFound, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { subscriptionPatchSchema } from "@/lib/validators";

type Params = { id: string };

/** Partial update: edit fields, or change status (cancel / reactivate). */
export const PATCH = withUser<Params>(async (req, { user, params }) => {
  const sub = await db.subscription.findFirst({ where: { id: params.id, userId: user.id } });
  if (!sub) throw notFound("Subscription");
  const data = await parseBody(req, subscriptionPatchSchema);
  await db.subscription.update({
    where: { id: sub.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.amount !== undefined ? { amount: toMinor(data.amount) } : {}),
      ...(data.billingCycle !== undefined ? { billingCycle: data.billingCycle } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.nextPaymentDate !== undefined ? { nextPaymentDate: dateFromKey(data.nextPaymentDate) } : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.status !== undefined
        ? { status: data.status, cancelledAt: data.status === "CANCELLED" ? new Date() : null }
        : {}),
    },
  });
  return json({ ok: true });
});

export const DELETE = withUser<Params>(async (_req, { user, params }) => {
  // Linked past transactions are kept (subscriptionId is set to NULL by the relation).
  const result = await db.subscription.deleteMany({ where: { id: params.id, userId: user.id } });
  if (!result.count) throw notFound("Subscription");
  return json({ ok: true });
});
