import { db } from "@/lib/db";
import { parseQuery, withUser } from "@/lib/api";
import { transactionsToCsv } from "@/lib/csv";
import { dayKey } from "@/lib/dates";
import { fromMinor } from "@/lib/money";
import { transactionQuerySchema } from "@/lib/validators";
import { buildTransactionWhere } from "@/server/transaction-filters";

/** Exports the user's transactions as CSV, honouring the same filters as the list view. */
export const GET = withUser(async (req, { user }) => {
  const q = parseQuery(req, transactionQuerySchema);
  const rows = await db.transaction.findMany({ where: buildTransactionWhere(user.id, q), orderBy: { date: "desc" } });
  const csv = transactionsToCsv(rows.map((r) => ({ ...r, amount: fromMinor(r.amount) })));
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finsight-transactions-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
