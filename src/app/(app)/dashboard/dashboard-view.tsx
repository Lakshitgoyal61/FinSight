"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  FileUp,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import type { DashboardDTO } from "@/server/data";
import { getCategory } from "@/lib/constants";
import { formatDate, formatMonthLabel, monthKey, relativeDayLabel } from "@/lib/dates";
import { api, refreshAll } from "@/lib/client";
import { cn } from "@/lib/utils";
import { useApp, useMoney } from "@/components/app-context";
import { CategoryDonut, IncomeExpenseBars, SimpleBars, Sparkline, SpendingCurveChart, Legend } from "@/components/charts/charts";
import { CategoryIcon, GOAL_COLOR_VARS, Icon } from "@/components/icons";
import { HealthRing, InsightRow, healthTone } from "@/components/insights/insight-card";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Delta, EmptyState, ErrorState, FadeIn } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";

type Data = DashboardDTO & { currency: string };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { data, error, isLoading, mutate } = useSWR<Data>("/api/dashboard");
  const { user } = useApp();
  const { newTransaction } = useQuickActions();
  const [hello, setHello] = React.useState("Welcome back");
  React.useEffect(() => setHello(greeting()), []);
  const firstName = user.name.split(" ")[0];

  if (error && !data) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data) return <DashboardSkeleton />;
  if (!data.hasData) return <WelcomeEmpty name={firstName ?? user.name} />;

  return (
    <div className="space-y-5">
      <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            {hello}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s your financial overview for {formatMonthLabel(monthKey(new Date()), true)}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => newTransaction("INCOME")}>
            <ArrowDownLeft className="text-income" /> Add income
          </Button>
          <Button onClick={() => newTransaction("EXPENSE")} className="sm:hidden">
            <Plus /> Expense
          </Button>
        </div>
      </FadeIn>

      <KpiRow data={data} />

      <div className="grid gap-5 xl:grid-cols-3">
        <FadeIn delay={0.05} className="xl:col-span-2">
          <SpendingOverview data={data} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <HealthCard data={data} />
        </FadeIn>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <FadeIn delay={0.05}>
          <CategoryCard data={data} />
        </FadeIn>
        <FadeIn delay={0.08}>
          <Card className="h-full">
            <CardHeader>
              <div>
                <CardTitle>Income vs expenses</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </div>
              <Legend items={[{ label: "Income", color: "var(--chart-income)" }, { label: "Expenses", color: "var(--chart-expense)" }]} />
            </CardHeader>
            <CardContent>
              <IncomeExpenseBars data={data.monthly} height={230} />
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.11} className="md:col-span-2 xl:col-span-1">
          <WeeklyCard data={data} />
        </FadeIn>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <FadeIn delay={0.05} className="xl:col-span-2">
          <RecentTransactions data={data} />
        </FadeIn>
        <FadeIn delay={0.08}>
          <SmartInsights data={data} />
        </FadeIn>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FadeIn delay={0.05}>
          <GoalsCard data={data} />
        </FadeIn>
        <FadeIn delay={0.08}>
          <BudgetsAndBills data={data} />
        </FadeIn>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ KPIs

function KpiRow({ data }: { data: Data }) {
  const money = useMoney();
  const o = data.overview;
  const monthlyNet = data.monthly.map((m) => m.income - m.expense);
  const cards = [
    {
      label: "Total balance",
      hint: "All income minus all expenses, excluding money set aside in savings goals.",
      value: money(o.balance),
      delta: <Delta value={o.balanceChange} suffix="vs last month" />,
      icon: Wallet,
      accent: "var(--violet)",
      spark: monthlyNet.reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? 0) + v], []),
    },
    {
      label: "Income this month",
      hint: "Compared with the same days of last month.",
      value: money(o.income),
      delta: <Delta value={o.incomeChange} suffix="vs last month" />,
      icon: ArrowDownLeft,
      accent: "var(--chart-income)",
      spark: data.monthly.map((m) => m.income),
    },
    {
      label: "Spent this month",
      hint: "Compared with the same days of last month. Lower is better.",
      value: money(o.expense),
      delta: <Delta value={o.expenseChange} goodWhen="down" suffix="vs last month" />,
      icon: ArrowUpRight,
      accent: "var(--chart-expense)",
      spark: data.monthly.map((m) => m.expense),
    },
    {
      label: "Total savings",
      hint: "Sum of all savings goal contributions.",
      value: money(o.savings),
      delta: (
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-success tabular">{money(o.savedThisMonth, { signed: true })}</span> this month
        </span>
      ),
      icon: PiggyBank,
      accent: "var(--blue)",
      spark: null,
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, i) => (
        <FadeIn key={c.label} delay={i * 0.04}>
          <Card className="group relative h-full overflow-hidden p-5 transition-colors hover:border-border-strong" title={c.hint}>
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-20"
              style={{ background: c.accent }}
              aria-hidden
            />
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${c.accent} 16%, transparent)`, color: c.accent }}>
                <c.icon className="size-4" aria-hidden />
              </span>
              <p className="text-[13px] font-medium text-muted-foreground">{c.label}</p>
            </div>
            <p className="mt-3 font-display text-[26px] font-bold leading-none tracking-tight tabular">{c.value}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>{c.delta}</div>
              {c.spark && c.spark.length > 1 && (
                <div className="w-20">
                  <Sparkline values={c.spark} color={c.accent} height={28} />
                </div>
              )}
            </div>
          </Card>
        </FadeIn>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Spending overview

function SpendingOverview({ data }: { data: Data }) {
  const money = useMoney();
  const [view, setView] = React.useState<"month" | "trend">("month");
  const month = formatMonthLabel(monthKey(new Date()), true);
  const today = [...data.spendingCurve].reverse().find((d) => d.thisMonth !== null);
  const lastSame = today ? data.spendingCurve[today.day - 1]?.lastMonth ?? 0 : 0;
  const diff = today ? (today.thisMonth ?? 0) - lastSame : 0;
  return (
    <Card className="h-full">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
        <div>
          <CardTitle>Spending overview</CardTitle>
          <CardDescription>
            {view === "month" ? (
              <>
                {money(today?.thisMonth ?? 0)} spent so far ·{" "}
                <span className={diff > 0 ? "text-danger" : "text-success"}>
                  {money(Math.abs(diff))} {diff > 0 ? "more" : "less"}
                </span>{" "}
                than this point last month
              </>
            ) : (
              "Monthly spending, last 6 months"
            )}
          </CardDescription>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "month" | "trend")}>
          <TabsList aria-label="Spending view">
            <TabsTrigger value="month">This month</TabsTrigger>
            <TabsTrigger value="trend">6 months</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-3">
        {view === "month" ? (
          <>
            <Legend className="mb-2" items={[{ label: month, color: "var(--chart-expense)" }, { label: "Last month", color: "var(--chart-axis)", dashed: true }]} />
            <SpendingCurveChart data={data.spendingCurve} monthLabel={month} height={270} />
          </>
        ) : (
          <SimpleBars data={data.monthly.map((m) => ({ label: m.label, expense: m.expense }))} dataKey="expense" labelKey="label" height={292} highlightLast seriesLabel="Spent" />
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Health

function HealthCard({ data }: { data: Data }) {
  const money = useMoney();
  const h = data.health;
  const tone = healthTone(h.score, h.hasEnoughData);
  const rate = data.overview.savingsRate;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div>
          <CardTitle>Financial health</CardTitle>
          <CardDescription>Explainable score from your own data</CardDescription>
        </div>
        <Badge tone={h.score >= 65 ? "success" : h.score >= 45 ? "warning" : "danger"}>{h.label}</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-center gap-5">
          <HealthRing health={h} size={118} stroke={10} />
          <dl className="grid flex-1 gap-3 text-[13px]">
            <div>
              <dt className="text-muted-foreground">Savings ratio</dt>
              <dd className="font-semibold tabular">{rate === null ? "—" : `${Math.round(rate)}%`} <span className="font-normal text-muted-foreground">this month</span></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Budget utilization</dt>
              <dd className="font-semibold tabular">
                {data.budgets.count ? `${Math.round(data.budgets.utilization)}%` : "No budgets"}
                {data.budgets.count > 0 && <span className="font-normal text-muted-foreground"> of {money(data.budgets.limit, { compact: true })}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recurring costs</dt>
              <dd className="font-semibold tabular">{money(Math.round(data.recurringMonthly))}<span className="font-normal text-muted-foreground">/mo</span></dd>
            </div>
          </dl>
        </div>
        <ul className="mt-5 space-y-2">
          {h.components.slice(0, 3).map((c) => (
            <li key={c.key} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">{c.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(c.score / c.max) * 100}%`, background: healthTone((c.score / c.max) * 100).color }} />
              </div>
              <span className="w-10 text-right tabular text-muted-foreground">{Math.round(c.score)}/{c.max}</span>
            </li>
          ))}
        </ul>
        <Link href="/insights" className={cn("mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium hover:underline", tone.cls)}>
          See full breakdown <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Categories / weekly

function CategoryCard({ data }: { data: Data }) {
  const total = data.categories.reduce((a, c) => a + c.amount, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Spending breakdown</CardTitle>
          <CardDescription>By category, this month</CardDescription>
        </div>
        <Link href="/analytics" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          Details
        </Link>
      </CardHeader>
      <CardContent>
        {data.categories.length ? (
          <CategoryDonut data={data.categories} total={total} size={150} />
        ) : (
          <EmptyState compact icon={Sparkles} title="No spending yet" description="Expenses you add this month will be grouped here." />
        )}
      </CardContent>
    </Card>
  );
}

function WeeklyCard({ data }: { data: Data }) {
  const money = useMoney();
  const total = data.week.reduce((a, d) => a + d.expense, 0);
  const avg = total / 7;
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Last 7 days</CardTitle>
          <CardDescription>
            {money(total)} spent · avg {money(Math.round(avg))}/day
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <SimpleBars data={data.week} dataKey="expense" labelKey="label" height={230} highlightLast seriesLabel="Spent" />
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Recent + insights

function RecentTransactions({ data }: { data: Data }) {
  const money = useMoney();
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your latest activity</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/transactions">
            View all <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-2 pt-3 sm:px-3">
        <ul>
          {data.recent.map((t) => (
            <li key={t.id}>
              <Link href={`/transactions?q=${encodeURIComponent(t.title)}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent">
                <CategoryIcon category={t.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {getCategory(t.category).label} · {formatDate(`${t.date}T12:00:00Z`, { day: "numeric", month: "short" })} · {t.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-semibold tabular", t.type === "INCOME" ? "text-success" : "text-foreground")}>
                    {t.type === "INCOME" ? "+" : "−"}
                    {money(t.amount)}
                  </p>
                  <p className="text-[11px] text-subtle-foreground">{t.type === "INCOME" ? "Income" : "Expense"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SmartInsights({ data }: { data: Data }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-4 text-[color:var(--violet)]" aria-hidden /> Smart insights
          </CardTitle>
          <CardDescription>Generated from your transactions</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-3">
        {data.insights.length ? (
          <div className="space-y-0.5">
            {data.insights.map((i) => (
              <InsightRow key={i.id} insight={i} compact />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Sparkles} title="Nothing unusual" description="Keep adding transactions — insights appear as patterns emerge." />
        )}
        <div className="px-3 pt-2">
          <Link href="/insights" className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--violet)] hover:underline">
            All insights <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Goals, budgets & bills

function GoalsCard({ data }: { data: Data }) {
  const money = useMoney();
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Savings goals</CardTitle>
          <CardDescription>Progress towards what matters</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/goals">
            Manage <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.goals.length === 0 ? (
          <EmptyState compact icon={Target} title="No goals yet" description="Set a target like an emergency fund or a new laptop." action={<Button asChild size="sm"><Link href="/goals?new=1">Create a goal</Link></Button>} />
        ) : (
          data.goals.map((g) => {
            const color = GOAL_COLOR_VARS[g.color] ?? "var(--violet)";
            return (
              <div key={g.id} className="flex items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
                  <Icon name={g.icon} className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    <p className="text-xs font-semibold tabular">{Math.round(g.percent)}%</p>
                  </div>
                  <Progress value={g.percent} className="mt-1.5 h-1.5" indicatorStyle={{ background: color }} label={`${g.title} progress`} />
                  <p className="mt-1 text-xs text-muted-foreground tabular">
                    {money(g.saved)} of {money(g.target)}
                    {g.status === "completed" ? " · Completed" : g.targetDate ? ` · by ${formatDate(`${g.targetDate}T12:00:00Z`, { month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function BudgetsAndBills({ data }: { data: Data }) {
  const money = useMoney();
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Budgets & upcoming bills</CardTitle>
          <CardDescription>
            {data.budgets.count
              ? `${data.budgets.exceeded} over · ${data.budgets.warning} close to the limit`
              : "Set monthly limits to stay on track"}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/budgets">
            Budgets <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {data.budgets.count === 0 ? (
          <p className="text-sm text-muted-foreground">
            No budgets for this month. <Link href="/budgets" className="font-medium text-[color:var(--violet)] hover:underline">Create one</Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {data.budgets.top.map((b) => {
              const tone = b.state === "exceeded" ? "var(--danger)" : b.state === "warning" ? "var(--warning)" : "var(--chart-income)";
              return (
                <li key={b.id}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{getCategory(b.category).label}</span>
                    <span className="tabular text-muted-foreground">
                      {money(b.spent, { compact: true })} / {money(b.limit, { compact: true })}
                    </span>
                  </div>
                  <Progress value={b.utilization} className="mt-1.5 h-1.5" indicatorStyle={{ background: tone }} label={`${getCategory(b.category).label} budget used`} />
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
            <CalendarClock className="size-3.5" aria-hidden /> Next 14 days
          </p>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription payments due.</p>
          ) : (
            <ul className="space-y-1">
              {data.upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-1">
                  <CategoryIcon category={s.category} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{relativeDayLabel(new Date(`${s.nextPaymentDate}T12:00:00Z`))}</span>
                  <span className="w-20 text-right text-sm font-medium tabular">{money(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ Empty + loading

function WelcomeEmpty({ name }: { name: string }) {
  const { newTransaction } = useQuickActions();
  const [loading, setLoading] = React.useState(false);
  async function loadSample() {
    setLoading(true);
    try {
      await api("/api/user/reset-demo", { method: "POST" });
      toast.success("Sample data loaded", { description: "Explore freely — you can delete it anytime from Settings." });
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load sample data");
    } finally {
      setLoading(false);
    }
  }
  const steps = [
    { icon: Plus, title: "Add a transaction", body: "Log an expense or your salary in a few seconds.", action: <Button size="sm" onClick={() => newTransaction("EXPENSE")}>Add transaction</Button> },
    { icon: FileUp, title: "Import from CSV", body: "Bring in history exported from your bank or another app.", action: <Button asChild size="sm" variant="secondary"><Link href="/transactions?import=1">Import CSV</Link></Button> },
    { icon: PiggyBank, title: "Create a budget", body: "Set monthly limits for the categories you care about.", action: <Button asChild size="sm" variant="secondary"><Link href="/budgets">Set budgets</Link></Button> },
  ];
  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Welcome to FinSight, {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your dashboard comes alive as soon as you add some data. Here&apos;s how to start.</p>
      </FadeIn>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <FadeIn key={s.title} delay={i * 0.05}>
            <Card className="flex h-full flex-col p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-[color:var(--violet)]">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold">
                <span className="mr-1.5 text-subtle-foreground">{i + 1}.</span>
                {s.title}
              </h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.body}</p>
              <div className="mt-4">{s.action}</div>
            </Card>
          </FadeIn>
        ))}
      </div>
      <FadeIn delay={0.15}>
        <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
          <Sparkles className="size-5 text-[color:var(--violet)]" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold">Just exploring?</p>
            <p className="text-sm text-muted-foreground">Load six months of realistic sample data into your empty account to see every feature in action.</p>
          </div>
          <Button variant="outline" loading={loading} onClick={loadSample}>
            Load sample data
          </Button>
        </Card>
      </FadeIn>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-7 w-36" />
            <Skeleton className="mt-4 h-4 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-[260px] w-full" />
        </Card>
        <Card className="p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-6 flex items-center gap-5">
            <Skeleton className="size-28 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </Card>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-6 h-48 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
