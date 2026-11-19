import { db } from "@/lib/db";
import { errorResponse, handleError, json, parseBody } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validators";

// Compared against when the email doesn't exist, so response timing doesn't reveal registered emails.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("timing-safe-placeholder-1"));

export async function POST(req: Request) {
  try {
    const data = await parseBody(req, loginSchema);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `login:${ip}:${data.email}`;
    const limit = rateLimit(key, 8, 10 * 60_000);
    if (!limit.ok) {
      return errorResponse(429, `Too many attempts. Please wait ${Math.ceil(limit.retryAfter / 60)} minute(s) and try again.`);
    }

    const user = await db.user.findUnique({ where: { email: data.email } });
    const valid = await verifyPassword(data.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) return errorResponse(401, "Incorrect email or password");

    resetRateLimit(key);
    await createSession(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email, onboarded: user.onboarded } });
  } catch (err) {
    return handleError(err);
  }
}
