/** Removes accounts created by the Playwright suite (emails ending in @example.com). Cascades to all their data. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
db.user
  .deleteMany({ where: { email: { endsWith: "@example.com" } } })
  .then((r) => console.log(`Removed ${r.count} test account(s)`))
  .finally(() => db.$disconnect());
