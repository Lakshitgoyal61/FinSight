"use client";

import { mutate } from "swr";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

export async function api<T = unknown>(url: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "Network error — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Request failed", (data as { fields?: Record<string, string> }).fields ?? {});
  }
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

/**
 * After any financial mutation, revalidate every cached API view so dashboards, budgets,
 * analytics and insights all reflect the change immediately.
 */
export function refreshAll() {
  return mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

/** Trigger a file download from an API endpoint that returns an attachment. */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiClientError(res.status, (data as { error?: string }).error ?? "Download failed");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
