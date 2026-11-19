"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarDays, ChevronRight, Mail, PiggyBank, Repeat, Settings, ShieldCheck, Target } from "lucide-react";
import type { PreferencesDTO } from "@/server/data";
import { BUDGETING_STYLES, CURRENCIES, FINANCIAL_GOAL_OPTIONS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { api, ApiClientError, errorMessage } from "@/lib/client";
import { fieldErrors, profileSchema } from "@/lib/validators";
import { initials } from "@/lib/utils";
import { useApp } from "@/components/app-context";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field, Input, Skeleton } from "@/components/ui/primitives";

type Me = {
  user: { id: string; name: string; email: string; isDemo: boolean; createdAt: string };
  preferences: PreferencesDTO;
  stats: { transactions: number; budgets: number; goals: number; subscriptions: number; trackingSince: string | null; activeSessions: number };
};

export function ProfileView() {
  const { data, mutate } = useSWR<Me>("/api/me");
  const { setUser, user: ctxUser } = useApp();
  const [form, setForm] = React.useState({ name: "", email: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) setForm({ name: data.user.name, email: data.user.email });
  }, [data]);

  const dirty = data && (form.name !== data.user.name || form.email !== data.user.email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      const res = await api<{ user: { name: string; email: string } }>("/api/user/profile", { method: "PATCH", body: parsed.data });
      setUser({ ...ctxUser, name: res.user.name, email: res.user.email });
      toast.success("Profile updated");
      void mutate();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-8 w-40" />
        <Card className="mt-6 flex items-center gap-5 p-6"><Skeleton className="size-20 rounded-full" /><div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-56" /></div></Card>
      </div>
    );
  }

  const { user, preferences: p, stats } = data;
  const currency = CURRENCIES.find((c) => c.code === p.currency);
  const style = BUDGETING_STYLES.find((s) => s.id === p.budgetingStyle);
  const goals = FINANCIAL_GOAL_OPTIONS.filter((g) => p.financialGoals.includes(g.id));

  return (
    <div>
      <PageHeader title="Profile" description="Your account details and an overview of your FinSight activity." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden p-6">
            <div className="brand-gradient pointer-events-none absolute inset-x-0 top-0 h-20 opacity-25" aria-hidden />
            <div className="relative flex flex-col items-start gap-5 pt-6 sm:flex-row sm:items-end">
              <div className="flex size-20 items-center justify-center rounded-2xl border-4 border-card bg-[linear-gradient(135deg,#7c6cf0,#3987e5)] font-display text-2xl font-bold text-white shadow-pop">
                {initials(user.name)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-bold">{user.name}</h2>
                  {user.isDemo && <Badge tone="primary">Demo account</Badge>}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="size-3.5" aria-hidden /> {user.email}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /> Member since {formatDate(user.createdAt, { month: "long", year: "numeric" })}</p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Transactions", value: stats.transactions, icon: ArrowLeftRight, href: "/transactions" },
              { label: "Budgets", value: stats.budgets, icon: PiggyBank, href: "/budgets" },
              { label: "Savings goals", value: stats.goals, icon: Target, href: "/goals" },
              { label: "Active subscriptions", value: stats.subscriptions, icon: Repeat, href: "/subscriptions" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="surface group rounded-2xl p-4 transition-colors hover:border-border-strong">
                <s.icon className="size-4 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-display text-2xl font-bold tabular">{s.value.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Link>
            ))}
          </div>

          <Card className="p-6">
            <h2 className="text-[17px] font-semibold">Personal information</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">This is how you appear in FinSight.</p>
            <form onSubmit={submit} noValidate className="mt-5 grid max-w-lg gap-4">
              <Field label="Full name" htmlFor="p-name" error={errors.name}>
                <Input id="p-name" autoComplete="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Email" htmlFor="p-email" error={errors.email} hint={user.isDemo ? "The demo account's email is fixed." : "Used to sign in."}>
                <Input id="p-email" type="email" autoComplete="email" disabled={user.isDemo} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} aria-invalid={Boolean(errors.email)} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={saving} disabled={!dirty}>Save changes</Button>
                {dirty && (
                  <Button type="button" variant="ghost" onClick={() => setForm({ name: user.name, email: user.email })}>
                    Discard
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Preferences</h2>
              <Link href="/settings" className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Edit <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Currency</dt><dd className="font-medium">{currency ? `${currency.symbol} ${currency.code}` : p.currency}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Budgeting style</dt><dd className="font-medium">{style?.label ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Theme</dt><dd className="font-medium capitalize">{p.theme}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tracking since</dt><dd className="font-medium">{stats.trackingSince ? formatDate(`${stats.trackingSince}T12:00:00Z`, { month: "short", year: "numeric" }) : "—"}</dd></div>
            </dl>
            {goals.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Focus areas</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {goals.map((g) => (
                    <li key={g.id}><Badge tone="primary"><Icon name={g.icon} /> {g.label}</Badge></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[15px] font-semibold"><ShieldCheck className="size-4 text-[color:var(--teal)]" aria-hidden /> Account security</h2>
            <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
              <li>Password stored as a bcrypt hash</li>
              <li>{stats.activeSessions} active session{stats.activeSessions === 1 ? "" : "s"}</li>
              <li>Data visible only to you</li>
            </ul>
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/settings#security"><Settings /> Security settings</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
