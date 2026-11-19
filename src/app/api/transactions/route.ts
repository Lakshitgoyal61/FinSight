import { db } from "@/lib/db";
import { json, parseBody, parseQuery, withUser } from "@/lib/api";
import { dateFromKey } from "@/lib/dates";
import { fromMinor, toMinor } from "@/lib/money";
import { transactionQuerySchema, transactionSchema } from "@/lib/validators";
import { serializeTransaction } from "@/server/data";
import { buildTransactionOrder, buildTransactionWhere } from "@/server/transaction-filters";

export const GET = withUser(async (req, { user }) => {
  const q = parseQuery(req, transactionQuerySchema);
  const where = buildTransactionWhere(user.id, q);

  const [total, rows, sums] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      orderBy: buildTransactionOrder(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);
  const income = fromMinor(sums.find((s) => s.type === "INCOME")?._sum.amount ?? 0);
  const expense = fromMinor(sums.find((s) => s.type === "EXPENSE")?._sum.amount ?? 0);

  return json({
    items: rows.map(serializeTransaction),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    totals: { income, expense, net: Math.round((income - expense) * 100) / 100 },
  });
});

export const POST = withUser(async (req, { user }) => {
  const data = await parseBody(req, transactionSchema);
  const created = await db.transaction.create({
    data: {
      userId: user.id,
      title: data.title,
      amount: toMinor(data.amount),
      type: data.type,
      category: data.category,
      date: dateFromKey(data.date),
      paymentMethod: data.paymentMethod,
      description: data.description,
    },
  });
  return json({ transaction: serializeTransaction(created) }, { status: 201 });
});
