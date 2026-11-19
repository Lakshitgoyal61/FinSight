"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowDownToLine, CalendarDays, Check, History, MoreHorizontal, Pencil, Plus, PartyPopper, Target, Trash2, TrendingUp } from "lucide-react";
import type { GoalDTO } from "@/server/data";
import { GOAL_COLORS, GOAL_ICONS } from "@/lib/constants";
import { formatDate, todayKey } from "@/lib/dates";
import { currencySymbol } from "@/lib/money";
import { api, ApiClientError, errorMessage, refreshAll } from "@/lib/client";
import { contributionSchema, fieldErrors, goalSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { useApp, useMoney } from "@/components/app-context";
import { GOAL_COLOR_VARS, Icon } from "@/components/icons";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, Card, Field, Input, Progress, Skeleton } from "@/components/ui/primitives";

const STATUS: Record<GoalDTO["status"], { label: string; tone: "success" | "primary" | "warning" | "danger" | "neutral" }> = {
  completed: { label: "Completed", tone: "success" },
  on_track: { label: "On track", tone: "primary" },
  behind: { label: "Behind schedule", tone: "warning" },
  overdue: { label: "Past target date", tone: "danger" },
  no_deadline: { label: "No deadline", tone: "neutral" },
};

const TEMPLATES = [
  { title: "New Laptop", icon: "laptop", color: "violet", target: 90000 },
  { title: "Emergency Fund", icon: "shield", color: "teal", target: 150000 },
  { title: "International Trip", icon: "plane", color: "blue", target: 200000 },
  { title: "New Phone", icon: "smartphone", color: "amber", target: 60000 },
];

export function GoalsView() {
  const money = useMoney();
  const router = useRouter();
  const params = useSearchParams();
  const { data, error, isLoading, mutate } = useSWR<{ goals: GoalDTO[] }>("/api/goals");
  const [formState, setFormState] = React.useState<FormState>(params.get("new") ? {} : null);
  const [contrib, setContrib] = React.useState<{ goal: GoalDTO; kind: "deposit" | "withdrawal" } | null>(null);
  const [history, setHistory] = React.useState<GoalDTO | null>(null);
  const [toDelete, setToDelete] = React.useState<GoalDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const goals = data?.goals ?? [];
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const totalTarget = goals.reduce((a, g) => a + g.target, 0);
  const completed = goals.filter((g) => g.status === "completed").length;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/goals/${toDelete.id}`, { method: "DELETE" });
      toast.success(`“${toDelete.title}” deleted`);
      setToDelete(null);
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Savings goals"
        description="Turn plans into progress. Every contribution moves the needle."
        actions={
          <Button onClick={() => setFormState({})}>
            <Plus /> New goal
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading goals">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="size-12 rounded-xl" />
              <Skeleton className="mt-4 h-5 w-40" />
              <Skeleton className="mt-6 h-3 w-full" />
              <Skeleton className="mt-3 h-4 w-32" />
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Target} title="Set your first savings goal" description="Pick a template or create your own. We'll tell you how much to save each month." />
          <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => setFormState({ template: t })}
                className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-accent"
              >
                <span className="flex size-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${GOAL_COLOR_VARS[t.color]} 16%, transparent)`, color: GOAL_COLOR_VARS[t.color] }}>
                  <Icon name={t.icon} className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{t.title}</span>
                  <span className="block text-xs text-muted-foreground">Suggested {money(t.target)}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="grid gap-5 p-5 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Total saved</p>
              <p className="mt-1 font-display text-2xl font-bold tabular">{money(totalSaved)}</p>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Across all targets</p>
              <p className="mt-1 font-display text-2xl font-bold tabular">{totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0}%</p>
              <Progress value={totalTarget ? (totalSaved / totalTarget) * 100 : 0} className="mt-2 h-1.5" label="Overall progress" />
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Goals completed</p>
              <p className="mt-1 font-display text-2xl font-bold tabular">
                {completed} <span className="text-base font-medium text-muted-foreground">of {goals.length}</span>
              </p>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <GoalCard
                  g={g}
                  onAdd={() => setContrib({ goal: g, kind: "deposit" })}
                  onWithdraw={() => setContrib({ goal: g, kind: "withdrawal" })}
                  onEdit={() => setFormState({ goal: g })}
                  onHistory={() => setHistory(g)}
                  onDelete={() => setToDelete(g)}
                />
              </motion.div>
            ))}
            <button
              onClick={() => setFormState({})}
              className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Plus className="size-5" aria-hidden />
              <span className="text-sm font-medium">Add another goal</span>
            </button>
          </div>
        </div>
      )}

      <GoalFormDialog
        state={formState}
        onClose={() => {
          setFormState(null);
          if (params.get("new")) router.replace("/goals");
        }}
      />
      <ContributionDialog state={contrib} onClose={() => setContrib(null)} />
      <HistoryDialog goal={history ? goals.find((g) => g.id === history.id) ?? history : null} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this goal?"
        description={toDelete ? `“${toDelete.title}” and its ${toDelete.contributions.length} contribution record(s) will be permanently removed.` : ""}
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ProgressRing({ percent, color, size = 84 }: { percent: number; color: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--muted)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - percent / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold tabular">{Math.round(percent)}%</span>
    </div>
  );
}

function GoalCard({ g, onAdd, onWithdraw, onEdit, onHistory, onDelete }: { g: GoalDTO; onAdd: () => void; onWithdraw: () => void; onEdit: () => void; onHistory: () => void; onDelete: () => void }) {
  const money = useMoney();
  const color = GOAL_COLOR_VARS[g.color] ?? "var(--violet)";
  const st = STATUS[g.status];
  return (
    <Card className="relative flex h-full flex-col overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-[0.14] blur-2xl" style={{ background: color }} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
            <Icon name={g.icon} className="size-6" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold">{g.title}</h3>
            <Badge tone={st.tone} className="mt-1">
              {g.status === "completed" && <Check aria-hidden />} {st.label}
            </Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${g.title}`} className="relative text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onHistory}><History /> Contribution history</DropdownMenuItem>
            <DropdownMenuItem onSelect={onWithdraw} disabled={g.saved <= 0}><ArrowDownToLine /> Withdraw</DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit goal</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <ProgressRing percent={g.percent} color={color} />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tabular">{money(g.saved)}</p>
          <p className="text-sm text-muted-foreground tabular">of {money(g.target)}</p>
          {g.status !== "completed" && <p className="mt-1 text-xs text-muted-foreground tabular">{money(g.remaining)} to go</p>}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="size-3.5" aria-hidden /> Target date</dt>
          <dd className="mt-0.5 font-semibold">
            {g.targetDate ? formatDate(`${g.targetDate}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" }) : "Flexible"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="size-3.5" aria-hidden /> Needed / month</dt>
          <dd className="mt-0.5 font-semibold tabular">{g.status === "completed" ? "Done" : g.monthlyNeeded ? money(Math.round(g.monthlyNeeded)) : "—"}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-4">
        {g.status === "completed" ? (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-success-soft py-2.5 text-sm font-medium text-success">
            <PartyPopper className="size-4" aria-hidden /> Goal reached
          </div>
        ) : (
          <Button className="w-full" variant="secondary" onClick={onAdd}>
            <Plus /> Add money
          </Button>
        )}
      </div>
    </Card>
  );
}

type FormState = ({ goal?: GoalDTO; template?: (typeof TEMPLATES)[number] }) | null;

function GoalFormDialog({ state, onClose }: { state: FormState; onClose: () => void }) {
  const { currency } = useApp();
  const editing = state?.goal;
  const [form, setForm] = React.useState({ title: "", targetAmount: "", targetDate: "", icon: "target", color: "violet", initialAmount: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.goal) {
      const g = state.goal;
      setForm({ title: g.title, targetAmount: String(g.target), targetDate: g.targetDate ?? "", icon: g.icon, color: g.color, initialAmount: "" });
    } else if (state.template) {
      const t = state.template;
      setForm({ title: t.title, targetAmount: String(t.target), targetDate: "", icon: t.icon, color: t.color, initialAmount: "" });
    } else {
      setForm({ title: "", targetAmount: "", targetDate: "", icon: "target", color: "violet", initialAmount: "" });
    }
  }, [state]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, targetDate: form.targetDate || null, initialAmount: form.initialAmount || 0 };
    const parsed = goalSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/goals/${editing.id}`, { method: "PATCH", body: payload });
        toast.success("Goal updated");
      } else {
        await api("/api/goals", { method: "POST", body: payload });
        toast.success(`“${form.title}” created`, { description: "Add money whenever you save towards it." });
      }
      onClose();
      void refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const sym = currencySymbol(currency);
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={editing ? "Edit goal" : "New savings goal"} description="Give it a name, a target, and optionally a date.">
        <form onSubmit={submit} noValidate className="grid gap-4">
          {!editing && (
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.title}
                  onClick={() => setForm((f) => ({ ...f, title: t.title, icon: t.icon, color: t.color, targetAmount: f.targetAmount || String(t.target) }))}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
          <Field label="Goal name" htmlFor="g-title" error={errors.title}>
            <Input id="g-title" autoFocus placeholder="e.g. Emergency fund" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} aria-invalid={Boolean(errors.title)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target amount" htmlFor="g-target" error={errors.targetAmount}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
                <Input id="g-target" inputMode="decimal" placeholder="100000" className="pl-8 tabular" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={Boolean(errors.targetAmount)} />
              </div>
            </Field>
            <Field label="Target date" htmlFor="g-date" optional error={errors.targetDate}>
              <Input id="g-date" type="date" min={todayKey()} value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </Field>
          </div>
          {!editing && (
            <Field label="Already saved" htmlFor="g-initial" optional error={errors.initialAmount} hint="Recorded as your first contribution.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
                <Input id="g-initial" inputMode="decimal" placeholder="0" className="pl-8 tabular" value={form.initialAmount} onChange={(e) => setForm((f) => ({ ...f, initialAmount: e.target.value.replace(/[^\d.]/g, "") }))} />
              </div>
            </Field>
          )}
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Icon</legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Goal icon">
              {GOAL_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  role="radio"
                  aria-checked={form.icon === ic}
                  aria-label={ic.replace("-", " ")}
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                  className={cn("flex size-9 items-center justify-center rounded-lg border transition-colors", form.icon === ic ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <Icon name={ic} className="size-4" />
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium">Color</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Goal color">
              {GOAL_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  role="radio"
                  aria-checked={form.color === c}
                  aria-label={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn("flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-shadow", form.color === c && "ring-2 ring-foreground")}
                  style={{ background: GOAL_COLOR_VARS[c] }}
                >
                  {form.color === c && <Check className="size-4 text-white" aria-hidden />}
                </button>
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create goal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContributionDialog({ state, onClose }: { state: { goal: GoalDTO; kind: "deposit" | "withdrawal" } | null; onClose: () => void }) {
  const { currency } = useApp();
  const money = useMoney();
  const [form, setForm] = React.useState({ amount: "", note: "", date: todayKey() });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (state) {
      setForm({ amount: "", note: "", date: todayKey() });
      setErrors({});
    }
  }, [state]);

  if (!state) return <Dialog open={false} />;
  const { goal, kind } = state;
  const quick = kind === "deposit" ? [500, 1000, 5000, Math.round(goal.remaining)].filter((v, i, a) => v > 0 && a.indexOf(v) === i) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { amount: form.amount, kind, note: form.note || null, date: form.date };
    const parsed = contributionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    if (kind === "withdrawal" && parsed.data.amount > goal.saved) {
      setErrors({ amount: `You can withdraw up to ${money(goal.saved)}` });
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ completed: boolean }>(`/api/goals/${goal.id}/contributions`, { method: "POST", body: payload });
      if (res.completed) toast.success(`🎉 You reached “${goal.title}”!`, { description: "Amazing discipline. Time to celebrate — responsibly." });
      else toast.success(kind === "deposit" ? `Added ${money(parsed.data.amount)} to “${goal.title}”` : `Withdrew ${money(parsed.data.amount)}`);
      onClose();
      void refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError) setErrors(err.fields);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={kind === "deposit" ? `Add money to “${goal.title}”` : `Withdraw from “${goal.title}”`}
        description={kind === "deposit" ? `${money(goal.remaining)} left to reach ${money(goal.target)}.` : `${money(goal.saved)} available.`}
      >
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label="Amount" htmlFor="c-amount" error={errors.amount}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
              <Input id="c-amount" autoFocus inputMode="decimal" placeholder="0" className="h-12 pl-8 text-lg tabular" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={Boolean(errors.amount)} />
            </div>
            {quick.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quick.map((q) => (
                  <button type="button" key={q} onClick={() => setForm((f) => ({ ...f, amount: String(q) }))} className="rounded-full border border-border px-3 py-1 text-xs tabular text-muted-foreground hover:border-border-strong hover:text-foreground">
                    {q === Math.round(goal.remaining) ? `Finish (${money(q)})` : money(q)}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="c-date" error={errors.date}>
              <Input id="c-date" type="date" max={todayKey()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Note" htmlFor="c-note" optional error={errors.note}>
              <Input id="c-note" maxLength={120} placeholder="e.g. Bonus" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} variant={kind === "withdrawal" ? "destructive" : "default"}>
              {kind === "deposit" ? "Add money" : "Withdraw"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ goal, onClose }: { goal: GoalDTO | null; onClose: () => void }) {
  const money = useMoney();
  const [removing, setRemoving] = React.useState<string | null>(null);
  async function remove(id: string) {
    if (!goal) return;
    setRemoving(id);
    try {
      await api(`/api/goals/${goal.id}/contributions/${id}`, { method: "DELETE" });
      toast.success("Contribution removed");
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRemoving(null);
    }
  }
  return (
    <Dialog open={goal !== null} onOpenChange={(o) => !o && onClose()}>
      {goal && (
        <DialogContent title="Contribution history" description={`${goal.title} · ${money(goal.saved)} saved`}>
          {goal.contributions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {goal.contributions.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.note || (c.amount >= 0 ? "Deposit" : "Withdrawal")}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(`${c.date}T12:00:00Z`)}</p>
                  </div>
                  <span className={cn("text-sm font-semibold tabular", c.amount >= 0 ? "text-success" : "text-danger")}>{money(c.amount, { signed: true })}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove contribution" loading={removing === c.id} onClick={() => remove(c.id)} className="text-muted-foreground hover:text-danger">
                    {removing !== c.id && <Trash2 />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
