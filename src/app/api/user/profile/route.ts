import { db } from "@/lib/db";
import { ApiError, json, parseBody, withUser } from "@/lib/api";
import { profileSchema } from "@/lib/validators";

export const PATCH = withUser(async (req, { user }) => {
  const data = await parseBody(req, profileSchema);
  if (user.isDemo && data.email !== user.email) {
    throw new ApiError(403, "The demo account's email can't be changed", { email: "Email is fixed for the demo account" });
  }
  if (data.email !== user.email) {
    const taken = await db.user.findUnique({ where: { email: data.email } });
    if (taken) throw new ApiError(409, "That email is already in use", { email: "That email is already in use" });
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: { name: data.name, email: data.email },
    select: { id: true, name: true, email: true },
  });
  return json({ user: updated });
});
