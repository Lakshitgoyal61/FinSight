"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { BarChart3, CalendarRange, Store, Table2, Wallet } from "lucide-react";
import type { AnalyticsDTO } from "@/server/data";
import { RANGE_PRESETS, addDays, dayKey, formatDate, type RangePreset } from "@/lib/dates";
import { categoryColor, getCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/app-context";
import { CategoryDonut, ChartTable, IncomeExpenseBars, Legend, SavingsRateLine, SimpleBars, TrendArea } from "@/components/charts/charts";
import { CategoryIcon } from "@/components/icons";
import { Delta, EmptyState, ErrorState, FadeIn, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui/primitives";
import { foldSlices } from "@/lib/finance/analytics";

export function AnalyticsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const money = useMoney();
  const range = (params.get("range") as RangePreset) ?? "30d";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const [customFrom, setCustomFrom] = React.useState(from || dayKey(addDays(new Date(), -59)));
  const [customTo, setCustomTo] = React.useState(to || dayKey(new Date()));
  const [customError, setCustomError] = React.useState<string | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const key = range === "custom" ? (from && to ? `/api/analytics?range=custom&from=${from}&to=${to}` : null) : `/api/analytics?range=${range}`;
  const { data, error, isLoading, mutate } = useSWR<AnalyticsDTO>(key);

  function setRange(r: RangePreset) {
    if (r === "custom") {
      router.replace(`${pathname}?range=custom${from && to ? `&from=${from}&to=${to}` : ""}`, { scroll: false });
    } else {
      router.replace(r === "30d" ? pathname : `${pathname}?range=${r}`, { scroll: false });
    }
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) return setCustomError("Choose both dates");
    if (customFrom > customTo) return setCustomError("Start date must be before the end date");
    setCustomError(null);
    router.replace(`${pathname}?range=custom&from=${customFrom}&to=${customTo}`, { scroll: false });
  }

  const s = data?.summary;
  const noPrior = "No earlier data";
  const periodLabel = data ? `${formatDate(`${data.range.from}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(`${data.range.to}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" })}` : "";
  const totalExpense = s?.expense ?? 0;
  const maxCat = data?.categories[0]?.amount ?? 1;

  return (
    <div>
      <PageHeader title="Analytics" description="Understand where your money goes — and how it's changing." />

      {/* Range filter */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Date range" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex gap-0.5 rounded-xl border border-border bg-background-subtle p-1">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={range === p.id}
                onClick={() => setRange(p.id)}
                className={cn(
                  "h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors",
                  range === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{p.short}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
        {data && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarRange className="size-3.5" aria-hidden /> {periodLabel} · {data.range.comparable ? `compared with the previous ${data.range.days} days` : "not enough earlier history to compare"}</p>}
      </div>

      {range === "custom" && (
        <Card className="mb-5 p-4">
          <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3" noValidate>
            <label className="grid gap-1.5 text-[13px] font-medium">
              From
              <Input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="w-44" />
            </label>
            <label className="grid gap-1.5 text-[13px] font-medium">
              To
              <Input type="date" value={customTo} min={customFrom} max={dayKey(new Date())} onChange={(e) => setCustomTo(e.target.value)} className="w-44" />
            </label>
            <Button type="submit">Apply range</Button>
            {customError && <p role="alert" className="text-sm text-danger">{customError}</p>}
          </form>
        </Card>
      )}

      {!key ? (
        <Card><EmptyState icon={CalendarRange} title="Choose a custom range" description="Pick a start and end date above, then apply." /></Card>
      ) : error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <AnalyticsSkeleton />
      ) : data && s ? (
        s.count === 0 ? (
          <Card><EmptyState icon={BarChart3} title="No transactions in this period" description="Try a longer date range, or add transactions to see analytics." /></Card>
        ) : (
          <div className={cn("space-y-5 transition-opacity", isLoading && "opacity-60")}>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Income" value={money(s.income)} delta={<Delta value={s.incomeChange} nullLabel={noPrior} />} />
              <Kpi label="Expenses" value={money(s.expense)} delta={<Delta value={s.expenseChange} goodWhen="down" nullLabel={noPrior} />} />
              <Kpi label="Net savings" value={money(s.net, { signed: true })} delta={<Delta value={s.netChange} nullLabel={noPrior} />} valueCls={s.net >= 0 ? "text-success" : "text-danger"} />
              <Kpi
                label="Savings ratio"
                value={s.savingsRate === null ? "—" : `${Math.round(s.savingsRate)}%`}
                delta={
                  s.savingsRate !== null && s.prevSavingsRate !== null ? (
                    <span className="text-xs text-muted-foreground">prev. {Math.round(s.prevSavingsRate)}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">of income kept</span>
                  )
                }
              />
              <Kpi label="Avg. daily spend" value={money(Math.round(s.dailyAverage))} delta={<span className="text-xs text-muted-foreground">{s.expenseCount} expenses</span>} className="col-span-2 lg:col-span-1" />
            </div>

            {/* Trend */}
            <FadeIn>
              <Card>
                <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>Income vs expenses over time</CardTitle>
                    <CardDescription>Grouped by {data.range.granularity}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Legend items={[{ label: "Income", color: "var(--chart-income)" }, { label: "Expenses", color: "var(--chart-expense)" }]} />
                    <Button variant="ghost" size="sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
                      {showTable ? <BarChart3 /> : <Table2 />} {showTable ? "Chart" : "Table"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showTable ? (
                    <ChartTable
                      visible
                      caption="Income and expenses over time"
                      columns={["Period", "Income", "Expenses", "Net"]}
                      rows={data.series.map((p) => [p.label, money(p.income), money(p.expense), money(p.net, { signed: true })])}
                    />
                  ) : (
                    <TrendArea data={data.series} height={300} />
                  )}
                </CardContent>
              </Card>
            </FadeIn>

            {/* Categories */}
            <div className="grid gap-5 lg:grid-cols-5">
              <FadeIn className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Spending distribution</CardTitle>
                      <CardDescription>{data.categories.length} categories · {money(totalExpense)}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CategoryDonut data={foldSlices(data.categories, 5)} total={totalExpense} size={170} />
                  </CardContent>
                </Card>
              </FadeIn>
              <FadeIn className="lg:col-span-3" delay={0.05}>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Top spending categories</CardTitle>
                      <CardDescription>{data.range.comparable ? "Change vs previous period" : "Share of spending in this period"}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3.5">
                      {data.categories.slice(0, 7).map((c) => (
                        <li key={c.category} className="flex items-center gap-3">
                          <CategoryIcon category={c.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{c.label}</span>
                              <span className="text-sm font-semibold tabular">{money(c.amount)}</span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full" style={{ width: `${(c.amount / maxCat) * 100}%`, background: categoryColor(c.category) }} />
                              </div>
                              <span className="w-9 text-right text-xs text-muted-foreground tabular">{c.share.toFixed(0)}%</span>
                              {data.range.comparable && <Delta value={c.change} goodWhen="down" className="w-16 justify-center" />}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </FadeIn>
            </div>

            {/* Monthly comparison + savings rate */}
            <div className="grid gap-5 lg:grid-cols-2">
              <FadeIn>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Monthly comparison</CardTitle>
                      <CardDescription>Income and expenses per month in range</CardDescription>
                    </div>
                    <Legend items={[{ label: "Income", color: "var(--chart-income)" }, { label: "Expenses", color: "var(--chart-expense)" }]} />
                  </CardHeader>
                  <CardContent>
                    <IncomeExpenseBars data={data.monthly} height={240} />
                  </CardContent>
                </Card>
              </FadeIn>
              <FadeIn delay={0.05}>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Savings ratio</CardTitle>
                      <CardDescription>Share of income kept each month</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SavingsRateLine data={data.monthly} height={240} />
                  </CardContent>
                </Card>
              </FadeIn>
            </div>

            {/* Patterns */}
            <div className="grid gap-5 lg:grid-cols-3">
              <FadeIn>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle>Spending by weekday</CardTitle>
                      <CardDescription>
                        Weekend days average {money(Math.round(data.weekendVsWeekday.weekendAvg))} vs {money(Math.round(data.weekendVsWeekday.weekdayAvg))} on weekdays
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SimpleBars data={data.weekday} dataKey="average" labelKey="day" height={210} seriesLabel="Avg. spent" />
                  </CardContent>
                </Card>
              </FadeIn>
              <FadeIn delay={0.04}>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle className="flex items-center gap-1.5"><Store className="size-4 text-muted-foreground" aria-hidden /> Top merchants</CardTitle>
                      <CardDescription>Where you spent the most</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3">
                      {data.merchants.map((m, i) => (
                        <li key={m.title} className="flex items-center gap-3">
                          <span className="w-4 text-xs font-semibold text-subtle-foreground tabular">{i + 1}</span>
                          <CategoryIcon category={m.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{m.title}</p>
                            <p className="text-xs text-muted-foreground">{m.count} {m.count === 1 ? "payment" : "payments"} · {getCategory(m.category).label}</p>
                          </div>
                          <span className="text-sm font-semibold tabular">{money(m.amount)}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </FadeIn>
              <FadeIn delay={0.08}>
                <Card className="h-full">
                  <CardHeader>
                    <div>
                      <CardTitle className="flex items-center gap-1.5"><Wallet className="size-4 text-muted-foreground" aria-hidden /> Payment methods</CardTitle>
                      <CardDescription>How you pay for expenses</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {data.paymentMethods.map((p) => {
                        const share = totalExpense ? (p.amount / totalExpense) * 100 : 0;
                        return (
                          <li key={p.method}>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{p.method}</span>
                              <span className="tabular text-muted-foreground">{money(p.amount)} · {share.toFixed(0)}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-[color:var(--blue)]" style={{ width: `${share}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </FadeIn>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function Kpi({ label, value, delta, valueCls, className }: { label: string; value: string; delta: React.ReactNode; valueCls?: string; className?: string }) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-bold tabular sm:text-[22px]", valueCls)}>{value}</p>
      <div className="mt-1.5">{delta}</div>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-3.5 w-20" /><Skeleton className="mt-2 h-6 w-28" /><Skeleton className="mt-2 h-4 w-14" /></Card>
        ))}
      </div>
      <Card className="p-5"><Skeleton className="h-5 w-56" /><Skeleton className="mt-5 h-[300px] w-full" /></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><Skeleton className="h-56 w-full" /></Card>
        <Card className="p-5"><Skeleton className="h-56 w-full" /></Card>
      </div>
    </div>
  );
}
