"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, type TransactionType } from "@/lib/constants";
import { todayKey } from "@/lib/dates";
import { currencySymbol } from "@/lib/money";
import { fieldErrors, transactionSchema } from "@/lib/validators";
import { api, ApiClientError, refreshAll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";

export type TransactionFormValue = {
  id?: string;
  title: string;
  amount: string;
  type: TransactionType;
  category: string;
  date: string;
  paymentMethod: string;
  description: string;
};

export function emptyTransaction(type: TransactionType = "EXPENSE"): TransactionFormValue {
  return {
    title: "",
    amount: "",
    type,
    category: type === "INCOME" ? "salary" : "food",
    date: todayKey(),
    paymentMethod: "UPI",
    description: "",
  };
}

export function TransactionDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TransactionFormValue;
}) {
  const { currency } = useApp();
  const [value, setValue] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const isEdit = Boolean(initial.id);

  React.useEffect(() => {
    if (open) {
      setValue(initial);
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof TransactionFormValue>(key: K, v: TransactionFormValue[K]) => {
    setValue((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const setType = (type: TransactionType) => {
    setValue((prev) => ({
      ...prev,
      type,
      category: type === "INCOME" ? (INCOME_CATEGORIES.some((c) => c.id === prev.category) ? prev.category : "salary") : EXPENSE_CATEGORIES.some((c) => c.id === prev.category) ? prev.category : "food",
    }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...value, amount: value.amount, description: value.description || null };
    const parsed = transactionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api(`/api/transactions/${initial.id}`, { method: "PATCH", body: payload });
        toast.success("Transaction updated");
      } else {
        await api("/api/transactions", { method: "POST", body: payload });
        toast.success(value.type === "INCOME" ? "Income added" : "Expense added", { description: value.title });
      }
      onOpenChange(false);
      void refreshAll();
    } catch (err) {
      if (err instanceof ApiClientError && Object.keys(err.fields).length) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Could not save the transaction");
    } finally {
      setSaving(false);
    }
  }

  const categories = value.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const err = (k: string) => errors[k] || undefined;
  const describedBy = (k: string) => (errors[k] ? `tx-${k}-error` : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Edit transaction" : "Add transaction"}
        description={isEdit ? "Update the details below. Totals and budgets recalculate instantly." : "Record income or an expense. Everything updates instantly."}
      >
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background-subtle p-1">
            {(["EXPENSE", "INCOME"] as const).map((t) => {
              const active = value.type === t;
              const Icon = t === "EXPENSE" ? ArrowUpRight : ArrowDownLeft;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active && (t === "EXPENSE" ? "text-expense" : "text-income"))} aria-hidden />
                  {t === "EXPENSE" ? "Expense" : "Income"}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <Field label={value.type === "INCOME" ? "Source" : "Merchant / title"} htmlFor="tx-title" error={err("title")}>
              <Input
                id="tx-title"
                autoFocus
                placeholder={value.type === "INCOME" ? "e.g. Monthly salary" : "e.g. Swiggy"}
                value={value.title}
                maxLength={80}
                onChange={(e) => set("title", e.target.value)}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={describedBy("title")}
              />
            </Field>
            <Field label="Amount" htmlFor="tx-amount" error={err("amount")}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
                <Input
                  id="tx-amount"
                  inputMode="decimal"
                  placeholder="0"
                  className="pl-8 tabular"
                  value={value.amount}
                  onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describedBy("amount")}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="tx-category" error={err("category")}>
              <NativeSelect id="tx-category" value={value.category} onChange={(e) => set("category", e.target.value)} aria-invalid={Boolean(errors.category)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Date" htmlFor="tx-date" error={err("date")}>
              <Input id="tx-date" type="date" value={value.date} max={todayKey(new Date(Date.now() + 365 * 86_400_000))} onChange={(e) => set("date", e.target.value)} aria-invalid={Boolean(errors.date)} />
            </Field>
          </div>

          <Field label="Payment method" htmlFor="tx-method" error={err("paymentMethod")}>
            <div id="tx-method" role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={value.paymentMethod === m}
                  onClick={() => set("paymentMethod", m)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] transition-colors",
                    value.paymentMethod === m ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notes" htmlFor="tx-desc" optional error={err("description")}>
            <Textarea id="tx-desc" rows={2} maxLength={500} placeholder="Add a note for future you" value={value.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <DialogFooter className="mt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : value.type === "INCOME" ? "Add income" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
