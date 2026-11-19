import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ApiError, json, parseBody, withUser } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { deleteAccountSchema } from "@/lib/validators";

/** Permanently delete the account. All related records are removed via ON DELETE CASCADE. */
export const DELETE = withUser(async (req, { user }) => {
  if (user.isDemo) throw new ApiError(403, "The demo account can't be deleted. Use “Reset demo data” instead.");
  const data = await parseBody(req, deleteAccountSchema);
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(data.password, record.passwordHash))) {
    throw new ApiError(422, "Password is incorrect", { password: "Password is incorrect" });
  }
  await db.user.delete({ where: { id: user.id } });
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});
