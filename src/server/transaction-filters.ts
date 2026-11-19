import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { dateFromKey, endOfDayUTC, startOfDayUTC } from "@/lib/dates";
import type { transactionQuerySchema } from "@/lib/validators";

type Query = z.output<typeof transactionQuerySchema>;

/** Shared filter builder used by the list and the CSV export, so both always match. */
export function buildTransactionWhere(userId: string, q: Query): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.type) where.type = q.type;
  if (q.category) where.category = { in: q.category.split(",").filter(Boolean) };
  if (q.from || q.to) {
    where.date = {
      ...(q.from ? { gte: startOfDayUTC(dateFromKey(q.from)) } : {}),
      ...(q.to ? { lte: endOfDayUTC(dateFromKey(q.to)) } : {}),
    };
  }
  if (q.q) where.OR = [{ title: { contains: q.q } }, { description: { contains: q.q } }];
  return where;
}

export function buildTransactionOrder(sort: Query["sort"]): Prisma.TransactionOrderByWithRelationInput[] {
  switch (sort) {
    case "amount_desc":
      return [{ amount: "desc" }, { date: "desc" }];
    case "amount_asc":
      return [{ amount: "asc" }, { date: "desc" }];
    case "date_asc":
      return [{ date: "asc" }, { createdAt: "asc" }];
    default:
      return [{ date: "desc" }, { createdAt: "desc" }];
  }
}
