import { db } from "@/lib/db";
import { json, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { subscriptionSchema } from "@/lib/validators";
import { getSubscriptions } from "@/server/data";

export const GET = withUser(async (_req, { user }) => {
  return json(await getSubscriptions(user.id));
});

export const POST = withUser(async (req, { user }) => {
  const data = await parseBody(req, subscriptionSchema);
  const sub = await db.subscription.create({
    data: {
      userId: user.id,
      name: data.name,
      amount: toMinor(data.amount),
      billingCycle: data.billingCycle,
      category: data.category,
      nextPaymentDate: dateFromKey(data.nextPaymentDate),
      paymentMethod: data.paymentMethod,
      notes: data.notes,
    },
  });
  return json({ subscription: { id: sub.id } }, { status: 201 });
});
