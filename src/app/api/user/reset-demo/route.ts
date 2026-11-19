import { db } from "@/lib/db";
import { ApiError, json, withUser } from "@/lib/api";
import { seedDemoData } from "@/lib/demo-data";

/** Regenerates sample data relative to today. Available for the demo account, or as an opt-in for any user with no data. */
export const POST = withUser(async (_req, { user }) => {
  if (!user.isDemo) {
    const count = await db.transaction.count({ where: { userId: user.id } });
    if (count > 0) throw new ApiError(403, "Sample data can only be loaded into an empty account");
  }
  const result = await seedDemoData(db, user.id);
  return json({ ok: true, ...result });
});
