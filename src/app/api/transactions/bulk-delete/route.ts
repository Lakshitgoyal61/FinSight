import { db } from "@/lib/db";
import { json, parseBody, withUser } from "@/lib/api";
import { bulkDeleteSchema } from "@/lib/validators";

export const POST = withUser(async (req, { user }) => {
  const { ids } = await parseBody(req, bulkDeleteSchema);
  // Scoped by userId: ids belonging to other users are ignored.
  const result = await db.transaction.deleteMany({ where: { userId: user.id, id: { in: ids } } });
  return json({ deleted: result.count });
});
