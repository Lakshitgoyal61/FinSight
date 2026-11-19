"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileUp,
  FilterX,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { TransactionDTO } from "@/server/data";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategory } from "@/lib/constants";
import { addDays, dayKey, formatDate, startOfMonthUTC, addMonthsUTC, endOfMonthUTC } from "@/lib/dates";
import { api, downloadFile, errorMessage, refreshAll } from "@/lib/client";
import { cn, pluralize } from "@/lib/utils";
import { useMoney } from "@/components/app-context";
import { CategoryIcon } from "@/components/icons";
import { useQuickActions } from "@/components/layout/quick-actions";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { ImportDialog } from "@/components/transactions/import-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Badge, Card, Checkbox, Input, NativeSelect, Skeleton } from "@/components/ui/primitives";

type ListResponse = {
  items: TransactionDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totals: { income: number; expense: number; net: number };
};

const SORTS = [
  { id: "date_desc", label: "Newest first" },
  { id: "date_asc", label: "Oldest first" },
  { id: "amount_desc", label: "Highest amount" },
  { id: "amount_asc", label: "Lowest amount" },
];

function datePresets(now = new Date()) {
  const thisMonth = startOfMonthUTC(now);
  const lastMonth = addMonthsUTC(thisMonth, -1);
  return [
    { id: "", label: "All time", from: "", to: "" },
    { id: "this_month", label: "This month", from: dayKey(thisMonth), to: dayKey(now) },
    { id: "last_month", label: "Last month", from: dayKey(lastMonth), to: dayKey(endOfMonthUTC(lastMonth)) },
    { id: "last_30", label: "Last 30 days", from: dayKey(addDays(now, -29)), to: dayKey(now) },
    { id: "last_90", label: "Last 90 days", from: dayKey(addDays(now, -89)), to: dayKey(now) },
    { id: "this_year", label: "This year", from: `${now.getUTCFullYear()}-01-01`, to: dayKey(now) },
  ];
}

export function TransactionsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const money = useMoney();
  const { newTransaction, editTransaction } = useQuickActions();

  const q = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const category = params.get("category") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const sort = params.get("sort") ?? "date_desc";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Number(params.get("pageSize") ?? 15) || 15;

  const [search, setSearch] = React.useState(q);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<TransactionDTO | null>(null);
  const [toDelete, setToDelete] = React.useState<TransactionDTO[] | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(params.get("import") === "1");
  const [exporting, setExporting] = React.useState(false);

  const update = React.useCallback(
    (patch: Record<string, string | number | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      next.delete("import");
      next.delete("new");
      router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Open "add income" when deep-linked from insights
  React.useEffect(() => {
    const n = params.get("new");
    if (n === "income" || n === "expense") {
      newTransaction(n === "income" ? "INCOME" : "EXPENSE");
      update({ new: null }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search → URL
  React.useEffect(() => setSearch(q), [q]);
  React.useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim() }), 300);
    return () => clearTimeout(t);
  }, [search, q, update]);

  const query = new URLSearchParams({ sort, page: String(page), pageSize: String(pageSize) });
  if (q) query.set("q", q);
  if (type) query.set("type", type);
  if (category) query.set("category", category);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const key = `/api/transactions?${query}`;
  const { data, error, isLoading, mutate } = useSWR<ListResponse>(key);

  React.useEffect(() => setSelected(new Set()), [key]);

  const filtersActive = Boolean(q || type || category || from || to);
  const presets = React.useMemo(() => datePresets(), []);
  const presetId = presets.find((p) => p.from === from && p.to === to)?.id ?? (from || to ? "custom" : "");

  const items = data?.items ?? [];
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));
  const someSelected = items.some((t) => selected.has(t.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function openEdit(t: TransactionDTO) {
    setDetail(null);
    editTransaction({
      id: t.id,
      title: t.title,
      amount: String(t.amount),
      type: t.type,
      category: t.category,
      date: t.date,
      paymentMethod: t.paymentMethod,
      description: t.description ?? "",
    });
  }

  function duplicate(t: TransactionDTO) {
    setDetail(null);
    editTransaction({
      title: t.title,
      amount: String(t.amount),
      type: t.type,
      category: t.category,
      date: dayKey(new Date()),
      paymentMethod: t.paymentMethod,
      description: t.description ?? "",
    });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const removed = toDelete;
    try {
      if (removed.length === 1) await api(`/api/transactions/${removed[0]!.id}`, { method: "DELETE" });
      else await api("/api/transactions/bulk-delete", { method: "POST", body: { ids: removed.map((t) => t.id) } });
      setToDelete(null);
      setDetail(null);
      setSelected(new Set());
      void refreshAll();
      toast.success(removed.length === 1 ? `Deleted “${removed[0]!.title}”` : `Deleted ${removed.length} transactions`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              for (const t of removed) {
                await api("/api/transactions", {
                  method: "POST",
                  body: { title: t.title, amount: t.amount, type: t.type, category: t.category, date: t.date, paymentMethod: t.paymentMethod, description: t.description },
                });
              }
              toast.success("Restored");
              void refreshAll();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          },
        },
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const exportQuery = new URLSearchParams(query);
      exportQuery.delete("page");
      exportQuery.delete("pageSize");
      await downloadFile(`/api/transactions/export?${exportQuery}`, "finsight-transactions.csv");
      toast.success(filtersActive ? "Exported filtered transactions" : "Exported all transactions");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const categoryOptions = type === "INCOME" ? INCOME_CATEGORIES : type === "EXPENSE" ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const firstItem = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastItem = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Search, filter and manage every rupee in and out."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileUp /> Import
            </Button>
            <Button variant="secondary" onClick={exportCsv} loading={exporting}>
              <Download /> Export
            </Button>
            <Button onClick={() => newTransaction("EXPENSE")}>
              <Plus /> Add
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-4 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search transactions"
              placeholder="Search merchant or note…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <NativeSelect aria-label="Transaction type" value={type} onChange={(e) => update({ type: e.target.value, category: null })}>
            <option value="">All types</option>
            <option value="EXPENSE">Expenses</option>
            <option value="INCOME">Income</option>
          </NativeSelect>
          <NativeSelect aria-label="Category" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Date range"
            value={presetId}
            onChange={(e) => {
              const p = presets.find((x) => x.id === e.target.value);
              if (p) update({ from: p.from, to: p.to });
            }}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {presetId === "custom" && <option value="custom">Custom range</option>}
          </NativeSelect>
          <NativeSelect aria-label="Sort" value={sort} onChange={(e) => update({ sort: e.target.value === "date_desc" ? null : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            From
            <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} className="h-8 w-[9.5rem] text-xs" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            To
            <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} className="h-8 w-[9.5rem] text-xs" />
          </label>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); update({ q: null, type: null, category: null, from: null, to: null }); }}>
              <FilterX /> Clear filters
            </Button>
          )}
          {data && (
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{pluralize(data.total, "transaction")}</span>
              <span>
                In <span className="font-semibold text-success tabular">{money(data.totals.income)}</span>
              </span>
              <span>
                Out <span className="font-semibold text-foreground tabular">{money(data.totals.expense)}</span>
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="sticky top-[72px] z-10 mb-3 flex items-center gap-3 rounded-xl border border-primary/40 bg-popover px-4 py-2.5 shadow-pop">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setToDelete(items.filter((t) => selected.has(t.id)))}>
            <Trash2 /> Delete selected
          </Button>
        </div>
      )}

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Card>
          {filtersActive ? (
            <EmptyState
              icon={Search}
              title="No matching transactions"
              description="Try a different search term, or clear the filters to see everything."
              action={<Button variant="secondary" onClick={() => { setSearch(""); update({ q: null, type: null, category: null, from: null, to: null }); }}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No transactions yet"
              description="Add your first income or expense, or import your history from a CSV file."
              action={
                <div className="flex gap-2">
                  <Button onClick={() => newTransaction("EXPENSE")}><Plus /> Add transaction</Button>
                  <Button variant="secondary" onClick={() => setImportOpen(true)}><FileUp /> Import CSV</Button>
                </div>
              }
            />
          )}
        </Card>
      ) : (
        <Card className={cn("overflow-hidden transition-opacity", isLoading && "opacity-60")}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Transactions</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-10 py-3 pl-4">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => setSelected(v ? new Set(items.map((t) => t.id)) : new Set())}
                    />
                  </th>
                  <th scope="col" className="py-3 pl-2 font-medium">Transaction</th>
                  <th scope="col" className="py-3 font-medium">Category</th>
                  <th scope="col" className="py-3 font-medium">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => update({ sort: sort === "date_desc" ? "date_asc" : null })}>
                      Date <ArrowDownUp className="size-3" aria-hidden />
                    </button>
                  </th>
                  <th scope="col" className="py-3 font-medium">Method</th>
                  <th scope="col" className="py-3 pr-2 text-right font-medium">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => update({ sort: sort === "amount_desc" ? "amount_asc" : "amount_desc" })}>
                      Amount <ArrowDownUp className="size-3" aria-hidden />
                    </button>
                  </th>
                  <th scope="col" className="w-12 py-3 pr-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    className={cn("group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/60", selected.has(t.id) && "bg-primary-soft")}
                    onClick={() => setDetail(t)}
                  >
                    <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${t.title}`} checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                    </td>
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-3">
                        <CategoryIcon category={t.category} size="sm" />
                        <div className="min-w-0">
                          <button
                            className="max-w-[18rem] truncate text-left font-medium hover:underline focus-visible:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(t);
                            }}
                          >
                            {t.title}
                          </button>
                          {t.description && <p className="max-w-[18rem] truncate text-xs text-muted-foreground">{t.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{getCategory(t.category).label}</td>
                    <td className="py-3 text-muted-foreground tabular">{formatDate(`${t.date}T12:00:00Z`)}</td>
                    <td className="py-3"><Badge tone="outline">{t.paymentMethod}</Badge></td>
                    <td className={cn("py-3 pr-2 text-right font-semibold tabular", t.type === "INCOME" ? "text-success" : "")}>
                      {t.type === "INCOME" ? "+" : "−"}
                      {money(t.amount)}
                    </td>
                    <td className="py-3 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu t={t} onView={() => setDetail(t)} onEdit={() => openEdit(t)} onDuplicate={() => duplicate(t)} onDelete={() => setToDelete([t])} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list, grouped by date */}
          <ul className="md:hidden">
            {items.map((t, i) => {
              const showDate = i === 0 || items[i - 1]!.date !== t.date;
              return (
                <li key={t.id}>
                  {showDate && sort.startsWith("date") && (
                    <p className="bg-background-subtle/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                      {formatDate(`${t.date}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Checkbox aria-label={`Select ${t.title}`} checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setDetail(t)}>
                      <CategoryIcon category={t.category} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {getCategory(t.category).label}
                          {!sort.startsWith("date") && ` · ${formatDate(`${t.date}T12:00:00Z`, { day: "numeric", month: "short" })}`}
                        </span>
                      </span>
                      <span className={cn("text-sm font-semibold tabular", t.type === "INCOME" && "text-success")}>
                        {t.type === "INCOME" ? "+" : "−"}
                        {money(t.amount)}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {data && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
              <p className="text-xs text-muted-foreground tabular">
                Showing {firstItem}–{lastItem} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <NativeSelect aria-label="Rows per page" value={String(pageSize)} onChange={(e) => update({ pageSize: e.target.value === "15" ? null : e.target.value })} className="h-8 w-[7.5rem] text-xs">
                  {[15, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </NativeSelect>
                <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => update({ page: page - 1 }, false)}>
                  <ChevronLeft />
                </Button>
                <span className="min-w-16 text-center text-xs tabular">
                  {data.page} / {data.totalPages}
                </span>
                <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => update({ page: page + 1 }, false)}>
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <TransactionDetail t={detail} onClose={() => setDetail(null)} onEdit={openEdit} onDelete={(t) => setToDelete([t])} onDuplicate={duplicate} />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} transactions?` : "Delete this transaction?"}
        description={
          toDelete && toDelete.length === 1 ? (
            <>
              <strong className="text-foreground">{toDelete[0]!.title}</strong> ({money(toDelete[0]!.amount)}) will be removed. Budgets and analytics update immediately. You can undo right after.
            </>
          ) : (
            "These transactions will be removed. Budgets and analytics update immediately. You can undo right after."
          )
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o && params.get("import")) update({ import: null }, false);
        }}
      />
    </div>
  );
}

function RowMenu({ t, onView, onEdit, onDuplicate, onDelete }: { t: TransactionDTO; onView: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`} className="text-muted-foreground opacity-70 group-hover:opacity-100">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onView}><Eye /> View details</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}><Copy /> Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={onDelete}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TransactionDetail({
  t,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  t: TransactionDTO | null;
  onClose: () => void;
  onEdit: (t: TransactionDTO) => void;
  onDelete: (t: TransactionDTO) => void;
  onDuplicate: (t: TransactionDTO) => void;
}) {
  const money = useMoney();
  const [last, setLast] = React.useState(t);
  React.useEffect(() => {
    if (t) setLast(t);
  }, [t]);
  const tx = t ?? last;
  return (
    <Dialog open={Boolean(t)} onOpenChange={(o) => !o && onClose()}>
      {tx && (
        <DialogContent title="Transaction details">
          <div className="flex flex-col items-center rounded-2xl border border-border bg-background-subtle px-4 py-6 text-center">
            <CategoryIcon category={tx.category} size="lg" />
            <p className="mt-3 text-base font-semibold">{tx.title}</p>
            <p className={cn("mt-1 font-display text-3xl font-bold tabular", tx.type === "INCOME" && "text-success")}>
              {tx.type === "INCOME" ? "+" : "−"}
              {money(tx.amount)}
            </p>
            <Badge tone={tx.type === "INCOME" ? "success" : "primary"} className="mt-2">
              {tx.type === "INCOME" ? "Income" : "Expense"}
            </Badge>
          </div>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              ["Category", getCategory(tx.category).label],
              ["Date", formatDate(`${tx.date}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
              ["Payment method", tx.paymentMethod],
              ["Notes", tx.description || "—"],
              ...(tx.subscriptionId ? [["Source", "Recorded from a subscription"]] : []),
              ["Last updated", formatDate(tx.updatedAt, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button variant="destructive-ghost" onClick={() => onDelete(tx)} className="sm:mr-auto">
              <Trash2 /> Delete
            </Button>
            <Button variant="secondary" onClick={() => onDuplicate(tx)}>
              <Copy /> Duplicate
            </Button>
            <Button onClick={() => onEdit(tx)}>
              <Pencil /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ListSkeleton() {
  return (
    <Card className="divide-y divide-border" aria-busy="true" aria-label="Loading transactions">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </Card>
  );
}
