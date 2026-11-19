import { db } from "@/lib/db";
import { ApiError, json, parseBody, withUser } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeOtherSessions } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validators";

export const POST = withUser(async (req, { user }) => {
  if (user.isDemo) throw new ApiError(403, "The demo account's password can't be changed");
  const data = await parseBody(req, changePasswordSchema);
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(data.currentPassword, record.passwordHash))) {
    throw new ApiError(422, "Current password is incorrect", { currentPassword: "Current password is incorrect" });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.newPassword) } });
  // Sign out every other device after a password change.
  await revokeOtherSessions(user.id);
  return json({ ok: true });
});
