import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "finsight_session";
const APP_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/analytics",
  "/budgets",
  "/goals",
  "/subscriptions",
  "/insights",
  "/settings",
  "/profile",
  "/onboarding",
];

/**
 * Edge-level guard. It is an optimisation and a CSRF defence only — real authorization happens
 * on the server for every page (requireUser) and every API route (withUser), against the database.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // CSRF: reject cross-origin state-changing API requests.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  if (APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$).*)"],
};
