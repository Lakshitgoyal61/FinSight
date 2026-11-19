"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Bell, Database, Download, FileJson, KeyRound, Monitor, Moon, Palette, RefreshCcw, Sun, Trash2, Wallet } from "lucide-react";
import type { PreferencesDTO } from "@/server/data";
import { BUDGETING_STYLES, CURRENCIES, FINANCIAL_GOAL_OPTIONS } from "@/lib/constants";
import { currencySymbol } from "@/lib/money";
import { api, ApiClientError, downloadFile, errorMessage, refreshAll } from "@/lib/client";
import { changePasswordSchema, fieldErrors } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/app-context";
import { PasswordChecklist, PasswordInput } from "@/components/auth/password-input";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Card, Field, Input, NativeSelect, Skeleton, Switch } from "@/components/ui/primitives";

type Me = { user: { isDemo: boolean; email: string }; preferences: PreferencesDTO };

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "finance", label: "Money & budgeting", icon: Wallet },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "data", label: "Your data", icon: Database },
];

export function SettingsView() {
  const { data, mutate } = useSWR<Me>("/api/me");
  const prefs = data?.preferences;
  const { setCurrency } = useApp();

  const save = React.useCallback(
    async (patch: Partial<PreferencesDTO>, message = "Preferences saved") => {
      if (!prefs) return;
      await mutate({ ...data!, preferences: { ...prefs, ...patch } }, { revalidate: false });
      try {
        await api("/api/user/preferences", { method: "PATCH", body: patch });
        toast.success(message);
        if (patch.currency) setCurrency(patch.currency);
        void refreshAll();
      } catch (e) {
        toast.error(errorMessage(e));
        void mutate();
      }
    },
    [data, mutate, prefs, setCurrency],
  );

  return (
    <div>
      <PageHeader title="Settings" description="Personalise FinSight. Changes are saved to your account instantly." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:px-0">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <s.icon className="size-4" aria-hidden /> {s.label}
            </a>
          ))}
        </nav>

        {!prefs || !data ? (
          <div className="space-y-5" aria-busy="true" aria-label="Loading settings">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6"><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-10 w-full" /><Skeleton className="mt-3 h-10 w-2/3" /></Card>
            ))}
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            <Appearance prefs={prefs} save={save} />
            <Finance prefs={prefs} save={save} />
            <Notifications prefs={prefs} save={save} />
            <Security isDemo={data.user.isDemo} />
            <DataSection isDemo={data.user.isDemo} />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

type SaveFn = (patch: Partial<PreferencesDTO>, message?: string) => Promise<void>;

function Appearance({ prefs, save }: { prefs: PreferencesDTO; save: SaveFn }) {
  const { setTheme } = useTheme();
  const options = [
    { id: "light", label: "Light", icon: Sun, preview: "bg-[#f4f6fb]" },
    { id: "dark", label: "Dark", icon: Moon, preview: "bg-[#060a18]" },
    { id: "system", label: "System", icon: Monitor, preview: "bg-[linear-gradient(90deg,#f4f6fb_50%,#060a18_50%)]" },
  ] as const;
  return (
    <Section id="appearance" title="Appearance" description="Choose how FinSight looks on this and every other device you sign in on.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={prefs.theme === o.id}
            onClick={() => {
              setTheme(o.id);
              try {
                sessionStorage.setItem("finsight:theme-synced", o.id);
              } catch {
                /* ignore */
              }
              void save({ theme: o.id }, `${o.label} theme saved`);
            }}
            className={cn("rounded-xl border p-2 text-left transition-colors", prefs.theme === o.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-border-strong")}
          >
            <span className={cn("block h-16 rounded-lg border border-border", o.preview)} aria-hidden />
            <span className="mt-2 flex items-center gap-1.5 px-1 text-sm font-medium">
              <o.icon className="size-3.5" aria-hidden /> {o.label}
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Finance({ prefs, save }: { prefs: PreferencesDTO; save: SaveFn }) {
  const [income, setIncome] = React.useState(prefs.monthlyIncome ? String(prefs.monthlyIncome) : "");
  const [savingIncome, setSavingIncome] = React.useState(false);
  const goals = new Set(prefs.financialGoals);
  return (
    <Section id="finance" title="Money & budgeting" description="Used to format amounts and personalise your insights and starter budgets.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Currency" htmlFor="currency" hint="Display only — amounts are not converted.">
          <NativeSelect id="currency" value={prefs.currency} onChange={(e) => save({ currency: e.target.value }, "Currency updated")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {c.label} ({c.code})
              </option>
            ))}
          </NativeSelect>
        </Field>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const v = income.trim() === "" ? null : Number(income);
            if (v !== null && (!Number.isFinite(v) || v < 0)) return toast.error("Enter a valid income amount");
            setSavingIncome(true);
            await save({ monthlyIncome: v }, "Monthly income saved");
            setSavingIncome(false);
          }}
        >
          <Field label="Expected monthly income" htmlFor="income" optional hint="Used as a fallback when no income is recorded yet.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(prefs.currency)}</span>
                <Input id="income" inputMode="decimal" className="pl-8 tabular" placeholder="0" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
              <Button type="submit" variant="secondary" loading={savingIncome}>Save</Button>
            </div>
          </Field>
        </form>
      </div>

      <fieldset className="mt-6">
        <legend className="text-[13px] font-medium">Budgeting style</legend>
        <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-2">
          {BUDGETING_STYLES.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={prefs.budgetingStyle === s.id}
              onClick={() => save({ budgetingStyle: s.id }, "Budgeting style saved")}
              className={cn("rounded-xl border p-3.5 text-left transition-colors", prefs.budgetingStyle === s.id ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
            >
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-[13px] font-medium">Your financial goals</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FINANCIAL_GOAL_OPTIONS.map((g) => {
            const on = goals.has(g.id);
            return (
              <button
                key={g.id}
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(goals);
                  if (on) next.delete(g.id);
                  else next.add(g.id);
                  void save({ financialGoals: [...next] }, "Goals updated");
                }}
                className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors", on ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                <Icon name={g.icon} className="size-3.5" /> {g.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </Section>
  );
}

function Notifications({ prefs, save }: { prefs: PreferencesDTO; save: SaveFn }) {
  const rows: { key: keyof PreferencesDTO; title: string; body: string }[] = [
    { key: "notifyBudgetAlerts", title: "Budget alerts", body: "When a budget approaches its alert threshold or goes over." },
    { key: "notifySubscriptionReminders", title: "Payment reminders", body: "Before a subscription renews." },
    { key: "notifyGoalMilestones", title: "Goal updates", body: "When a goal falls behind or is nearly complete." },
    { key: "notifyWeeklySummary", title: "Weekly summary", body: "A recap of the last 7 days pinned to your notification center." },
  ];
  return (
    <Section id="notifications" title="Notifications" description="Choose what appears in your in-app notification center (the bell icon).">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-4 py-3.5">
            <label htmlFor={r.key} className="cursor-pointer">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted-foreground">{r.body}</span>
            </label>
            <Switch id={r.key} checked={Boolean(prefs[r.key])} onCheckedChange={(v) => save({ [r.key]: v } as Partial<PreferencesDTO>, `${r.title} ${v ? "on" : "off"}`)} />
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 py-3.5">
          <label htmlFor="reminderDays">
            <span className="block text-sm font-medium">Remind me</span>
            <span className="block text-xs text-muted-foreground">How many days before a payment is due.</span>
          </label>
          <NativeSelect id="reminderDays" className="w-36" value={String(prefs.reminderDays)} onChange={(e) => save({ reminderDays: Number(e.target.value) }, "Reminder window saved")}>
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>
                {d} day{d > 1 ? "s" : ""} before
              </option>
            ))}
          </NativeSelect>
        </li>
      </ul>
      {prefs.notifyWeeklySummary && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          FinSight runs without an email service, so the summary is delivered in-app (bell icon) only.
        </p>
      )}
    </Section>
  );
}

function Security({ isDemo }: { isDemo: boolean }) {
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      await api("/api/user/password", { method: "POST", body: form });
      toast.success("Password updated", { description: "Other devices have been signed out." });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Section id="security" title="Security" description="Change your password. You'll stay signed in here; other sessions are signed out.">
      {isDemo ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">The shared demo account&apos;s password can&apos;t be changed. Create your own account to try this.</p>
      ) : (
        <form onSubmit={submit} noValidate className="grid max-w-md gap-4">
          <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword}>
            <PasswordInput id="currentPassword" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} aria-invalid={Boolean(errors.currentPassword)} />
          </Field>
          <Field label="New password" htmlFor="newPassword" error={errors.newPassword}>
            <PasswordInput id="newPassword" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} aria-invalid={Boolean(errors.newPassword)} />
            <PasswordChecklist value={form.newPassword} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
            <PasswordInput id="confirmPassword" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} aria-invalid={Boolean(errors.confirmPassword)} />
          </Field>
          <div>
            <Button type="submit" loading={saving}>Update password</Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function DataSection({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [del, setDel] = React.useState({ password: "", confirm: "" });
  const [delErrors, setDelErrors] = React.useState<Record<string, string>>({});

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section id="data" title="Your data" description="Your data belongs to you. Export it any time.">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => run("json", async () => { await downloadFile("/api/user/export", "finsight-export.json"); toast.success("Full export downloaded"); })}
          disabled={busy !== null}
          className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-border-strong hover:bg-accent disabled:opacity-60"
        >
          <FileJson className="mt-0.5 size-5 text-[color:var(--violet)]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold">{busy === "json" ? "Preparing…" : "Export everything (JSON)"}</span>
            <span className="block text-xs text-muted-foreground">Profile, preferences, transactions, budgets, goals, subscriptions.</span>
          </span>
        </button>
        <button
          onClick={() => run("csv", async () => { await downloadFile("/api/transactions/export", "finsight-transactions.csv"); toast.success("Transactions CSV downloaded"); })}
          disabled={busy !== null}
          className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-border-strong hover:bg-accent disabled:opacity-60"
        >
          <Download className="mt-0.5 size-5 text-[color:var(--teal)]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold">{busy === "csv" ? "Preparing…" : "Export transactions (CSV)"}</span>
            <span className="block text-xs text-muted-foreground">Opens in Excel or Google Sheets. Re-importable.</span>
          </span>
        </button>
      </div>

      {isDemo && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold">Reset demo data</p>
            <p className="text-xs text-muted-foreground">Regenerates six months of sample data relative to today. Your changes to the demo will be lost.</p>
          </div>
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            <RefreshCcw /> Reset demo
          </Button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-danger/30 p-4">
        <p className="text-sm font-semibold text-danger">Delete account</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Permanently deletes your account and all financial records. This cannot be undone.</p>
        <Button variant="destructive" className="mt-3" disabled={isDemo} onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Delete my account
        </Button>
        {isDemo && <p className="mt-2 text-xs text-muted-foreground">The shared demo account can&apos;t be deleted.</p>}
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo data?"
        description="All demo transactions, budgets, goals and subscriptions will be replaced with fresh sample data dated around today."
        confirmLabel="Reset data"
        loading={busy === "reset"}
        onConfirm={() =>
          run("reset", async () => {
            await api("/api/user/reset-demo", { method: "POST" });
            setResetOpen(false);
            toast.success("Demo data reset");
            await refreshAll();
          })
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) {
            setDel({ password: "", confirm: "" });
            setDelErrors({});
          }
        }}
        title="Delete your account permanently?"
        description="This removes your profile and every transaction, budget, goal and subscription. Consider exporting your data first."
        confirmLabel="Delete account"
        loading={busy === "delete"}
        onConfirm={() =>
          run("delete", async () => {
            const errs: Record<string, string> = {};
            if (!del.password) errs.password = "Enter your password";
            if (del.confirm !== "DELETE") errs.confirm = 'Type "DELETE" to confirm';
            setDelErrors(errs);
            if (Object.keys(errs).length) return;
            try {
              await api("/api/user", { method: "DELETE", body: del });
              toast.success("Your account has been deleted");
              router.replace("/");
              router.refresh();
            } catch (e) {
              if (e instanceof ApiClientError) setDelErrors(e.fields);
              throw e;
            }
          })
        }
      >
        <div className="mt-4 grid gap-3">
          <Field label="Your password" htmlFor="del-password" error={delErrors.password}>
            <PasswordInput id="del-password" autoComplete="current-password" value={del.password} onChange={(e) => setDel((d) => ({ ...d, password: e.target.value }))} />
          </Field>
          <Field label='Type "DELETE" to confirm' htmlFor="del-confirm" error={delErrors.confirm}>
            <Input id="del-confirm" autoComplete="off" value={del.confirm} onChange={(e) => setDel((d) => ({ ...d, confirm: e.target.value }))} />
          </Field>
        </div>
      </ConfirmDialog>
    </Section>
  );
}
