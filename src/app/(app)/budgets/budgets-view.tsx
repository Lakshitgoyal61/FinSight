"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CopyPlus, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2, TrendingUp } from "lucide-react";
import type { BudgetsDTO } from "@/server/data";
import { EXPENSE_CATEGORIES, getCategory } from "@/lib/constants";
import { formatMonthLabel, monthKey, shiftMonthKey, daysInMonthUTC } from "@/lib/dates";
import { currencySymbol } from "@/lib/money";
import { api, ApiClientError, errorMessage, refreshAll } from "@/lib/client";
import { budgetSchema, fieldErrors } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { useApp, useMoney } from "@/components/app-context";
import { CategoryIcon } from "@/components/icons";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, Card, Field, Input, NativeSelect, Progress, Skeleton } from "@/components/ui/primitives";

type Budget = BudgetsDTO["budgets"][number];

const STATE = {
  ok: { label: "On track", tone: "success" as const, icon: CheckCircle2, color: "var(--chart-income)" },
  warning: { label: "Approaching limit", tone: "warning" as const, icon: AlertTriangle, color: "var(--warning)" },
  exceeded: { label: "Over budget", tone: "danger" as const, icon: AlertOctagon, color: "var(--danger)" },
};

export function BudgetsView() {
  const money = useMoney();
  const current = monthKey(new Date());
  const [month, setMonth] = React.useState(current);
  const { data, error, isLoading, mutate } = useSWR<BudgetsDTO>(`/api/budgets?month=${month}`);
  const [dialog, setDialog] = React.useState<{ mode: "create" | "edit"; budget?: Budget; category?: string } | null>(null);
  const [toDelete, setToDelete] = React.useState<Budget | null>(null);
  const [busy, setBusy] = React.useState(false);
  const isCurrent = month === current;
  const isFuture = month > current;

  async function copyFromPrevious() {
    setBusy(true);
    try {
      const res = await api<{ copied: number; skipped: number }>("/api/budgets/copy", { method: "POST", body: { from: shiftMonthKey(month, -1), to: month } });
      toast.success(res.copied ? `Copied ${res.copied} budget${res.copied > 1 ? "s" : ""} from ${formatMonthLabel(shiftMonthKey(month, -1), true)}` : "All budgets already exist for this month");
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/api/budgets/${toDelete.id}`, { method: "DELETE" });
      toast.success(`${getCategory(toDelete.category).label} budget deleted`);
      setToDelete(null);
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const t = data?.totals;
  const remaining = t ? t.limit - t.spent : 0;
  const budgeted = new Set(data?.budgets.map((b) => b.category));

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Set monthly limits per category. Progress updates automatically as you spend."
        actions={
          <>
            <Button variant="secondary" onClick={copyFromPrevious} loading={busy && !toDelete}>
              <CopyPlus /> Copy last month
            </Button>
            <Button onClick={() => setDialog({ mode: "create" })} disabled={budgeted.size >= EXPENSE_CATEGORIES.length}>
              <Plus /> New budget
            </Button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(shiftMonthKey(month, -1))}>
          <ChevronLeft />
        </Button>
        <h2 className="min-w-40 text-center font-display text-lg font-semibold" aria-live="polite">
          {formatMonthLabel(month, true)}
        </h2>
        <Button variant="secondary" size="icon-sm" aria-label="Next month" onClick={() => setMonth(shiftMonthKey(month, 1))}>
          <ChevronRight />
        </Button>
        {!isCurrent && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(current)}>
            Back to this month
          </Button>
        )}
      </div>

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <BudgetsSkeleton />
      ) : data && data.budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title={`No budgets for ${formatMonthLabel(month, true)}`}
            description="Budgets help you spend intentionally. Start with the categories where you spend the most."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialog({ mode: "create" })}><Plus /> Create a budget</Button>
                <Button variant="secondary" onClick={copyFromPrevious} loading={busy}><CopyPlus /> Copy last month</Button>
              </div>
            }
          />
        </Card>
      ) : data && t ? (
        <div className={cn("space-y-5 transition-opacity", isLoading && "opacity-60")}>
          {/* Summary */}
          <Card className="p-5">
            <div className="grid gap-5 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center">
              <div>
                <p className="text-[13px] text-muted-foreground">Total budgeted spending</p>
                <p className="mt-1 font-display text-3xl font-bold tabular">
                  {money(t.spent)} <span className="text-base font-medium text-muted-foreground">of {money(t.limit)}</span>
                </p>
                <Progress
                  value={t.utilization}
                  className="mt-3 h-2.5"
                  indicatorStyle={{ background: t.utilization > 100 ? "var(--danger)" : t.utilization >= 80 ? "var(--warning)" : "var(--chart-income)" }}
                  label="Total budget used"
                />
                <p className="mt-2 text-xs text-muted-foreground tabular">
                  {Math.round(t.utilization)}% used ·{" "}
                  {remaining >= 0 ? `${money(remaining)} left` : <span className="text-danger">{money(-remaining)} over</span>}
                  {isCurrent && ` · ${daysInMonthUTC(new Date()) - new Date().getUTCDate()} days left`}
                </p>
              </div>
              <Stat label="On track" value={data.budgets.filter((b) => b.state === "ok").length} icon={CheckCircle2} cls="text-success" />
              <Stat label="Approaching" value={t.warning} icon={AlertTriangle} cls="text-warning" />
              <Stat label="Over budget" value={t.exceeded} icon={AlertOctagon} cls="text-danger" />
            </div>
          </Card>

          {/* Budget cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.budgets.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <BudgetCard
                  b={b}
                  isCurrent={isCurrent}
                  isFuture={isFuture}
                  onEdit={() => setDialog({ mode: "edit", budget: b })}
                  onDelete={() => setToDelete(b)}
                />
              </motion.div>
            ))}
          </div>

          {/* Unbudgeted spending */}
          {data.unbudgeted.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Spending without a budget</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">These categories had spending this month but no limit set.</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.unbudgeted.map((c) => (
                  <li key={c.category} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                    <CategoryIcon category={c.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground tabular">{money(c.amount)} spent</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "create", category: c.category })}>
                      Set limit
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      <BudgetDialog
        state={dialog}
        month={month}
        taken={budgeted}
        unbudgeted={data?.unbudgeted ?? []}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this budget?"
        description={toDelete ? `The ${getCategory(toDelete.category).label} budget for ${formatMonthLabel(month, true)} will be removed. Your transactions are not affected.` : ""}
        loading={busy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Stat({ label, value, icon: Icon, cls }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; cls: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 md:border-0 md:border-l md:rounded-none md:py-1">
      <Icon className={cn("size-5", cls)} aria-hidden />
      <div>
        <p className="font-display text-2xl font-bold tabular leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function BudgetCard({ b, isCurrent, isFuture, onEdit, onDelete }: { b: Budget; isCurrent: boolean; isFuture: boolean; onEdit: () => void; onDelete: () => void }) {
  const money = useMoney();
  // Within the current month, an "ok" budget whose pace projects past the limit is shown as at risk,
  // matching the insights engine's "on pace to overspend" rule.
  const atRisk = isCurrent && b.state === "ok" && b.projected !== null && b.projected > b.limit * 1.05;
  const s = atRisk ? { label: "At risk", tone: "warning" as const, icon: TrendingUp, color: "var(--chart-income)" } : STATE[b.state];
  const meta = getCategory(b.category);
  return (
    <Card className={cn("group flex h-full flex-col p-5 transition-colors hover:border-border-strong", b.state === "exceeded" && "border-danger/30")}>
      <div className="flex items-start gap-3">
        <CategoryIcon category={b.category} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{meta.label}</h3>
          <Badge tone={s.tone} className="mt-1">
            <s.icon aria-hidden /> {s.label}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${meta.label} budget`} className="text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit limit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-2">
        <p className="font-display text-xl font-bold tabular">{money(b.spent)}</p>
        <p className="text-sm text-muted-foreground tabular">of {money(b.limit)}</p>
      </div>
      <div className="relative mt-2.5">
        <Progress value={b.utilization} className="h-2" indicatorStyle={{ background: s.color }} label={`${meta.label}: ${Math.round(b.utilization)}% of budget used`} />
        <span className="absolute top-[-3px] h-3.5 w-0.5 rounded bg-foreground/40" style={{ left: `${b.alertThreshold}%` }} title={`Alert at ${b.alertThreshold}%`} aria-hidden />
      </div>
      <div className="mt-2 flex justify-between text-xs tabular">
        <span className="text-muted-foreground">{Math.round(b.utilization)}% used</span>
        <span className={b.remaining < 0 ? "font-medium text-danger" : "text-muted-foreground"}>
          {b.remaining >= 0 ? `${money(b.remaining)} left` : `${money(-b.remaining)} over`}
        </span>
      </div>
      {isCurrent && b.projected !== null && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted-foreground">Projected</p>
            <p className={cn("font-semibold tabular", b.projected > b.limit ? "text-danger" : "text-foreground")}>{money(Math.round(b.projected))}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Safe to spend / day</p>
            <p className="font-semibold tabular">{b.dailyAllowance !== null ? money(Math.round(b.dailyAllowance)) : "—"}</p>
          </div>
        </div>
      )}
      {isFuture && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Planned budget — tracking starts when the month begins.</p>}
    </Card>
  );
}

function BudgetDialog({
  state,
  month,
  taken,
  unbudgeted,
  onClose,
}: {
  state: { mode: "create" | "edit"; budget?: Budget; category?: string } | null;
  month: string;
  taken: Set<string>;
  unbudgeted: { category: string; amount: number }[];
  onClose: () => void;
}) {
  const { currency } = useApp();
  const money = useMoney();
  const available = EXPENSE_CATEGORIES.filter((c) => !taken.has(c.id) || c.id === state?.budget?.category);
  const [form, setForm] = React.useState({ category: "", limit: "", alertThreshold: 80 });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit" && state.budget) {
      setForm({ category: state.budget.category, limit: String(state.budget.limit), alertThreshold: state.budget.alertThreshold });
    } else {
      setForm({ category: state.category ?? available[0]?.id ?? "food", limit: "", alertThreshold: 80 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const spentHint = unbudgeted.find((u) => u.category === form.category)?.amount;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { category: form.category, month, limit: form.limit, alertThreshold: form.alertThreshold };
    const parsed = budgetSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      if (state?.mode === "edit" && state.budget) {
        await api(`/api/budgets/${state.budget.id}`, { method: "PATCH", body: { limit: form.limit, alertThreshold: form.alertThreshold } });
        toast.success("Budget updated");
      } else {
        await api("/api/budgets", { method: "POST", body: payload });
        toast.success(`${getCategory(form.category).label} budget created`);
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

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={state?.mode === "edit" ? "Edit budget" : "New budget"}
        description={`For ${formatMonthLabel(month, true)}. Spending is calculated from your expense transactions.`}
      >
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label="Category" htmlFor="b-category" error={errors.category}>
            <NativeSelect id="b-category" value={form.category} disabled={state?.mode === "edit"} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Monthly limit"
            htmlFor="b-limit"
            error={errors.limit}
            hint={spentHint ? `You've already spent ${money(spentHint)} on this category this month.` : undefined}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
              <Input
                id="b-limit"
                inputMode="decimal"
                autoFocus
                placeholder="5000"
                className="pl-8 tabular"
                value={form.limit}
                onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value.replace(/[^\d.]/g, "") }))}
                aria-invalid={Boolean(errors.limit)}
              />
            </div>
          </Field>
          <Field label={`Alert me at ${form.alertThreshold}% of the limit`} htmlFor="b-threshold" error={errors.alertThreshold} hint="You'll see a warning on the dashboard and in notifications when spending crosses this point.">
            <input
              id="b-threshold"
              type="range"
              min={50}
              max={100}
              step={5}
              value={form.alertThreshold}
              onChange={(e) => setForm((f) => ({ ...f, alertThreshold: Number(e.target.value) }))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{state?.mode === "edit" ? "Save changes" : "Create budget"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading budgets">
      <Card className="p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-64" />
        <Skeleton className="mt-4 h-2.5 w-full" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="mt-6 h-6 w-28" />
            <Skeleton className="mt-3 h-2 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
