import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema, type z } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { fieldErrors } from "@/lib/validators";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(status: number, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, ...(fields ? { fields } : {}) }, { status });
}

export async function parseBody<S extends ZodSchema>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(422, "Please fix the highlighted fields", fieldErrors(result.error));
  return result.data;
}

export function parseQuery<S extends ZodSchema>(req: Request, schema: S): z.output<S> {
  const params = Object.fromEntries(
    [...new URL(req.url).searchParams.entries()].filter(([, v]) => v !== ""),
  );
  const result = schema.safeParse(params);
  if (!result.success) throw new ApiError(400, "Invalid query parameters", fieldErrors(result.error));
  return result.data;
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Wrap a route handler so it only runs for an authenticated user. Every query inside the
 * handler is scoped by `user.id`, which is how per-user data isolation is enforced server-side.
 */
export function withUser<P = Record<string, string>>(
  handler: (req: Request, ctx: { user: SessionUser; params: P }) => Promise<Response>,
) {
  return async (req: Request, context: RouteContext<P>) => {
    try {
      const user = await getCurrentUser();
      if (!user) return errorResponse(401, "You need to sign in to continue");
      const params = (context?.params ? await context.params : {}) as P;
      return await handler(req, { user, params });
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return errorResponse(err.status, err.message, err.fields);
  if (err instanceof ZodError) return errorResponse(422, "Validation failed", fieldErrors(err));
  console.error("[api] unexpected error", err);
  return errorResponse(500, "Something went wrong on our side. Please try again.");
}

export function notFound(entity = "Record") {
  return new ApiError(404, `${entity} not found`);
}
