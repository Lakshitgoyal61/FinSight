"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Ban, CalendarClock, CheckCircle2, MoreHorizontal, Pencil, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react";
import type { SubscriptionDTO, SubscriptionsDTO } from "@/server/data";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, getCategory } from "@/lib/constants";
import { addDays, dayKey, formatDate, formatMonthLabel, relativeDayLabel, todayKey } from "@/lib/dates";
import { currencySymbol } from "@/lib/money";
import { api, ApiClientError, errorMessage, refreshAll } from "@/lib/client";
import { fieldErrors, subscriptionSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { useApp, useMoney } from "@/components/app-context";
import { SimpleBars } from "@/components/charts/charts";
import { CategoryIcon } from "@/components/icons";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, NativeSelect, Skeleton, Tabs, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";

export function SubscriptionsView() {
  const money = useMoney();
  const { data, error, isLoading, mutate } = useSWR<SubscriptionsDTO>("/api/subscriptions");
  const [tab, setTab] = React.useState<"ACTIVE" | "CANCELLED" | "ALL">("ACTIVE");
  const [dialog, setDialog] = React.useState<{ sub?: SubscriptionDTO } | null>(null);
  const [confirm, setConfirm] = React.useState<{ sub: SubscriptionDTO; action: "cancel" | "delete" } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const subs = data?.subscriptions ?? [];
  const list = subs.filter((s) => tab === "ALL" || s.status === tab);
  const active = subs.filter((s) => s.status === "ACTIVE");
  const next = [...active].sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate))[0];
  const horizon = dayKey(addDays(new Date(), 30));
  const upcoming = active.filter((s) => s.nextPaymentDate <= horizon).sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate));

  async function markPaid(s: SubscriptionDTO) {
    setBusy(s.id);
    try {
      const res = await api<{ nextPaymentDate: string }>(`/api/subscriptions/${s.id}/pay`, { method: "POST" });
      toast.success(`${s.name} payment recorded`, {
        description: `Added as an expense. Next payment ${formatDate(`${res.nextPaymentDate}T12:00:00Z`, { day: "numeric", month: "short" })}.`,
      });
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(s: SubscriptionDTO, status: "ACTIVE" | "CANCELLED") {
    setBusy(s.id);
    try {
      await api(`/api/subscriptions/${s.id}`, { method: "PATCH", body: { status } });
      toast.success(status === "CANCELLED" ? `${s.name} cancelled` : `${s.name} reactivated`, {
        description: status === "CANCELLED" ? `You'll save ${money(s.monthlyCost * 12)} a year.` : undefined,
      });
      setConfirm(null);
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: SubscriptionDTO) {
    setBusy(s.id);
    try {
      await api(`/api/subscriptions/${s.id}`, { method: "DELETE" });
      toast.success(`${s.name} deleted`, { description: "Past payments stay in your transactions." });
      setConfirm(null);
      void refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Every recurring charge in one place, with reminders before you pay."
        actions={
          <Button onClick={() => setDialog({})}>
            <Plus /> Add subscription
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="space-y-5" aria-busy="true" aria-label="Loading subscriptions">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-7 w-28" /></Card>
            ))}
          </div>
          <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>
        </div>
      ) : subs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No subscriptions tracked yet"
            description="Add Netflix, Spotify, gym memberships or any recurring bill. We'll calculate your monthly total and remind you before each payment."
            action={<Button onClick={() => setDialog({})}><Plus /> Add your first subscription</Button>}
          />
        </Card>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Monthly recurring" value={money(Math.round(data.totals.monthly))} sub="Yearly plans spread per month" />
            <SummaryCard label="Yearly cost" value={money(Math.round(data.totals.yearly))} sub="If nothing changes" />
            <SummaryCard label="Active subscriptions" value={String(data.totals.activeCount)} sub={`${subs.length - data.totals.activeCount} cancelled`} />
            <SummaryCard
              label="Next payment"
              value={next ? money(next.amount) : "—"}
              sub={next ? `${next.name} · ${relativeDayLabel(new Date(`${next.nextPaymentDate}T12:00:00Z`))}` : "Nothing due"}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle>Your subscriptions</CardTitle>
                  <CardDescription>Mark a payment as paid to record it as an expense automatically.</CardDescription>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                  <TabsList aria-label="Filter by status">
                    <TabsTrigger value="ACTIVE">Active</TabsTrigger>
                    <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
                    <TabsTrigger value="ALL">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="px-2 sm:px-3">
                {list.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No {tab === "CANCELLED" ? "cancelled" : "active"} subscriptions.</p>
                ) : (
                  <ul>
                    {list.map((s, i) => (
                      <motion.li key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                        <SubscriptionRow
                          s={s}
                          busy={busy === s.id}
                          onPay={() => markPaid(s)}
                          onEdit={() => setDialog({ sub: s })}
                          onCancel={() => setConfirm({ sub: s, action: "cancel" })}
                          onReactivate={() => setStatus(s, "ACTIVE")}
                          onDelete={() => setConfirm({ sub: s, action: "delete" })}
                        />
                      </motion.li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-1.5"><CalendarClock className="size-4 text-[color:var(--violet)]" aria-hidden /> Next 30 days</CardTitle>
                    <CardDescription>{upcoming.length ? `${money(upcoming.reduce((a, s) => a + s.amount, 0))} due` : "Nothing due"}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments in the next 30 days.</p>
                  ) : (
                    <ol className="relative space-y-4 border-l border-border pl-5">
                      {upcoming.map((s) => (
                        <li key={s.id} className="relative">
                          <span className={cn("absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-card", s.overdue ? "bg-danger" : s.daysUntil <= 3 ? "bg-warning" : "bg-primary")} aria-hidden />
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(`${s.nextPaymentDate}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" })} · {s.overdue ? <span className="text-danger">Overdue</span> : relativeDayLabel(new Date(`${s.nextPaymentDate}T12:00:00Z`))} · <span className="tabular">{money(s.amount)}</span>
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Subscription spending</CardTitle>
                    <CardDescription>Paid per month (recorded payments)</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <SimpleBars data={data.history.map((h) => ({ label: formatMonthLabel(h.month), amount: h.amount }))} dataKey="amount" labelKey="label" height={170} highlightLast seriesLabel="Paid" color="var(--cat-7)" />
                  {data.byCategory.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-border pt-4">
                      {data.byCategory.map((c) => (
                        <li key={c.category} className="flex items-center gap-2.5 text-[13px]">
                          <CategoryIcon category={c.category} size="sm" />
                          <span className="flex-1 text-muted-foreground">{getCategory(c.category).label}</span>
                          <span className="font-medium tabular">{money(Math.round(c.monthly))}/mo</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      <SubscriptionDialog state={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "cancel" ? `Cancel ${confirm.sub.name}?` : `Delete ${confirm?.sub.name}?`}
        description={
          confirm?.action === "cancel"
            ? `It will be moved to Cancelled and excluded from your recurring total. Remember to also cancel with the provider. You can reactivate it any time.`
            : "The subscription will be removed permanently. Payments already recorded stay in your transactions."
        }
        confirmLabel={confirm?.action === "cancel" ? "Cancel subscription" : "Delete"}
        loading={confirm ? busy === confirm.sub.id : false}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.action === "cancel") await setStatus(confirm.sub, "CANCELLED");
          else await remove(confirm.sub);
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

function SubscriptionRow({
  s,
  busy,
  onPay,
  onEdit,
  onCancel,
  onReactivate,
  onDelete,
}: {
  s: SubscriptionDTO;
  busy: boolean;
  onPay: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const money = useMoney();
  const cancelled = s.status === "CANCELLED";
  const due = new Date(`${s.nextPaymentDate}T12:00:00Z`);
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-accent/60 sm:flex-nowrap", cancelled && "opacity-60")}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--card-elevated),var(--muted))] font-display text-sm font-bold border border-border">
        {s.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{s.name}</p>
          <Badge tone="outline">{s.billingCycle === "YEARLY" ? "Yearly" : "Monthly"}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {getCategory(s.category).label} ·{" "}
          {cancelled ? (
            "Cancelled"
          ) : s.overdue ? (
            <span className="font-medium text-danger">Overdue since {formatDate(due, { day: "numeric", month: "short" })}</span>
          ) : (
            <>Next {formatDate(due, { day: "numeric", month: "short" })} ({relativeDayLabel(due).toLowerCase()})</>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular">{money(s.amount)}</p>
        <p className="text-[11px] text-muted-foreground tabular">{s.billingCycle === "YEARLY" ? `≈ ${money(Math.round(s.monthlyCost))}/mo` : "per month"}</p>
      </div>
      <div className="flex items-center gap-1">
        {!cancelled && (s.overdue || s.daysUntil <= 7) && (
          <Button size="sm" variant="secondary" loading={busy} onClick={onPay}>
            {!busy && <CheckCircle2 className="text-success" />} Mark paid
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`} className="text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {!cancelled && <DropdownMenuItem onSelect={onPay}><CheckCircle2 /> Record payment</DropdownMenuItem>}
            <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
            {cancelled ? (
              <DropdownMenuItem onSelect={onReactivate}><RotateCcw /> Reactivate</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onCancel}><Ban /> Cancel subscription</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function SubscriptionDialog({ state, onClose }: { state: { sub?: SubscriptionDTO } | null; onClose: () => void }) {
  const { currency } = useApp();
  const editing = state?.sub;
  const empty = { name: "", amount: "", billingCycle: "MONTHLY", category: "entertainment", nextPaymentDate: todayKey(), paymentMethod: "Card", notes: "" };
  const [form, setForm] = React.useState(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!state) return;
    setErrors({});
    setForm(
      state.sub
        ? { name: state.sub.name, amount: String(state.sub.amount), billingCycle: state.sub.billingCycle, category: state.sub.category, nextPaymentDate: state.sub.nextPaymentDate, paymentMethod: state.sub.paymentMethod, notes: state.sub.notes ?? "" }
        : empty,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, notes: form.notes || null };
    const parsed = subscriptionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/subscriptions/${editing.id}`, { method: "PATCH", body: payload });
        toast.success(`${form.name} updated`);
      } else {
        await api("/api/subscriptions", { method: "POST", body: payload });
        toast.success(`${form.name} added`, { description: "We'll remind you before it renews." });
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
      <DialogContent title={editing ? "Edit subscription" : "Add subscription"} description="Track any recurring charge — streaming, software, gym, insurance.">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label="Name" htmlFor="s-name" error={errors.name}>
            <Input id="s-name" autoFocus placeholder="e.g. Netflix" value={form.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount per cycle" htmlFor="s-amount" error={errors.amount}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
                <Input id="s-amount" inputMode="decimal" placeholder="499" className="pl-8 tabular" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))} aria-invalid={Boolean(errors.amount)} />
              </div>
            </Field>
            <Field label="Billing cycle" htmlFor="s-cycle" error={errors.billingCycle}>
              <NativeSelect id="s-cycle" value={form.billingCycle} onChange={set("billingCycle")}>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </NativeSelect>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="s-category" error={errors.category}>
              <NativeSelect id="s-category" value={form.category} onChange={set("category")}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Next payment date" htmlFor="s-next" error={errors.nextPaymentDate}>
              <Input id="s-next" type="date" value={form.nextPaymentDate} onChange={set("nextPaymentDate")} aria-invalid={Boolean(errors.nextPaymentDate)} />
            </Field>
          </div>
          <Field label="Payment method" htmlFor="s-method">
            <NativeSelect id="s-method" value={form.paymentMethod} onChange={set("paymentMethod")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notes" htmlFor="s-notes" optional error={errors.notes}>
            <Textarea id="s-notes" rows={2} maxLength={200} placeholder="e.g. Family plan, shared with 3 people" value={form.notes} onChange={set("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add subscription"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
