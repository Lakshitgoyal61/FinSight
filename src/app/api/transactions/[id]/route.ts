import { db } from "@/lib/db";
import { json, notFound, parseBody, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { transactionSchema } from "@/lib/validators";
import { serializeTransaction } from "@/server/data";

type Params = { id: string };

async function findOwned(userId: string, id: string) {
  const t = await db.transaction.findFirst({ where: { id, userId } });
  if (!t) throw notFound("Transaction");
  return t;
}

export const GET = withUser<Params>(async (_req, { user, params }) => {
  const t = await findOwned(user.id, params.id);
  return json({ transaction: serializeTransaction(t) });
});

export const PATCH = withUser<Params>(async (req, { user, params }) => {
  await findOwned(user.id, params.id);
  const data = await parseBody(req, transactionSchema);
  const updated = await db.transaction.update({
    where: { id: params.id },
    data: {
      title: data.title,
      amount: toMinor(data.amount),
      type: data.type,
      category: data.category,
      date: dateFromKey(data.date),
      paymentMethod: data.paymentMethod,
      description: data.description,
    },
  });
  return json({ transaction: serializeTransaction(updated) });
});

export const DELETE = withUser<Params>(async (_req, { user, params }) => {
  const t = await findOwned(user.id, params.id);
  await db.transaction.delete({ where: { id: t.id } });
  return json({ ok: true, transaction: serializeTransaction(t) });
});
