"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, PlayCircle } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/constants";
import { fieldErrors, loginSchema } from "@/lib/validators";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, Input, Separator } from "@/components/ui/primitives";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<"form" | "demo" | null>(null);

  async function signIn(creds: { email: string; password: string }, mode: "form" | "demo") {
    setFormError(null);
    const parsed = loginSchema.safeParse(creds);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(mode);
    try {
      const res = await api<{ user: { onboarded: boolean } }>("/api/auth/login", { method: "POST", body: parsed.data });
      router.replace(res.user.onboarded ? next ?? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue to your financial overview.</p>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="mt-7 w-full"
        loading={loading === "demo"}
        disabled={loading !== null}
        onClick={() => signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD }, "demo")}
      >
        {loading !== "demo" && <PlayCircle className="text-[color:var(--violet)]" />}
        Explore the live demo
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Demo account: <span className="font-mono">{DEMO_EMAIL}</span> / <span className="font-mono">{DEMO_PASSWORD}</span>
      </p>

      <div className="my-6 flex items-center gap-3 text-xs text-subtle-foreground">
        <Separator className="flex-1" /> or sign in with email <Separator className="flex-1" />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void signIn({ email, password }, "form");
        }}
        className="grid gap-4"
      >
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
          </div>
        )}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" loading={loading === "form"} disabled={loading !== null}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to FinSight?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
