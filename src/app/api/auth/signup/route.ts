import { db } from "@/lib/db";
import { ApiError, errorResponse, handleError, json, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { signupSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const limit = rateLimit(`signup:${ip}`, 30, 60 * 60_000);
    if (!limit.ok) return errorResponse(429, `Too many sign-up attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);

    const data = await parseBody(req, signupSchema);
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, "An account with this email already exists", { email: "This email is already registered. Try signing in." });

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        preference: { create: {} },
      },
    });
    await createSession(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email, onboarded: false } }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
