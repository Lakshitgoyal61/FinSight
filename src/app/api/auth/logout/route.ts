import { handleError, json } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  try {
    await destroySession();
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
