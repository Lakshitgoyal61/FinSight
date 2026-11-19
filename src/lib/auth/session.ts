import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "./constants";

const MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? 30) || 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 86_400_000;
/** Refresh lastSeen/expiry at most this often to avoid a DB write on every request. */
const TOUCH_INTERVAL_MS = 60 * 60_000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Sessions are opaque random tokens. Only a SHA-256 hash is stored in the database,
 * so a leaked database cannot be used to hijack sessions. Cookies are httpOnly + SameSite=Lax.
 */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  onboarded: boolean;
  isDemo: boolean;
  createdAt: Date;
};

/** Resolve the signed-in user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, onboarded: true, isDemo: true, createdAt: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } })
      .catch(() => undefined);
  }
  return session.user;
});

/** For server components/pages: redirect to login when signed out. */
export async function requireUser(options: { allowUnonboarded?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboarded && !options.allowUnonboarded) redirect("/onboarding");
  return user;
}

export async function revokeOtherSessions(userId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({
    where: { userId, ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}) },
  });
}
