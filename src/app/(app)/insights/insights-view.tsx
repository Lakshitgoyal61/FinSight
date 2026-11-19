"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronDown, Cpu, Lightbulb, ShieldCheck } from "lucide-react";
import type { InsightsDTO } from "@/server/data";
import type { InsightTopic } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";
import { HealthBreakdown, HealthRing, InsightCardLarge, healthTone } from "@/components/insights/insight-card";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";

const TOPICS: { id: InsightTopic | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "budget", label: "Budgets" },
  { id: "spending", label: "Spending" },
  { id: "savings", label: "Savings" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "goals", label: "Goals" },
  { id: "income", label: "Income" },
];

const RULES = [
  ["Category changes", "Compares each category's month-to-date spending with the same days of last month. Flags changes of 15% or more (and at least ₹500)."],
  ["Budget alerts", "Warns when a budget crosses your alert threshold, exceeds its limit, or is projected to overspend at the current daily pace."],
  ["Weekend patterns", "Compares average spending per weekend day with per weekday this month; flags when weekends are 1.3× higher."],
  ["Savings ratio", "Compares the share of income you kept this month with last month (changes of 5 points or more)."],
  ["Upcoming payments", "Lists active subscriptions due within your reminder window (set in Settings)."],
  ["Unusual transactions", "Flags a recent expense that is more than 2 standard deviations above your 90-day average for that category and at least 2.5× the median."],
  ["Savings opportunities", "Estimates what trimming your largest discretionary category by 20% would save per month and per year."],
  ["Goal tracking", "Compares how much of each goal is funded with how much of its timeline has passed, and calculates the monthly amount needed."],
  ["Overlapping subscriptions", "Spots three or more active subscriptions in the same category and shows their combined yearly cost."],
  ["Category concentration", "Highlights when a single non-housing category takes more than a third of your monthly spending."],
] as const;

export function InsightsView() {
  const { data, error, isLoading, mutate } = useSWR<InsightsDTO>("/api/insights");
  const [topic, setTopic] = React.useState<InsightTopic | "all">("all");
  const [showRules, setShowRules] = React.useState(false);

  const insights = data?.insights ?? [];
  const filtered = topic === "all" ? insights : insights.filter((i) => i.topic === topic);
  const counts = Object.fromEntries(TOPICS.map((t) => [t.id, t.id === "all" ? insights.length : insights.filter((i) => i.topic === t.id).length]));

  return (
    <div>
      <PageHeader
        title="Financial insights"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="size-3.5" aria-hidden /> Calculated locally from your own records by FinSight&apos;s rules engine — no guesses, no external AI.
          </span>
        }
      />

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="space-y-5" aria-busy="true" aria-label="Loading insights">
          <Card className="flex gap-6 p-6"><Skeleton className="size-36 rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div></Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-36 w-full" /></Card>)}</div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <Card className="grid gap-8 p-6 lg:grid-cols-[auto_1fr] lg:items-start">
            <div className="flex flex-col items-center text-center lg:w-56">
              <HealthRing health={data.health} size={164} stroke={13} />
              <p className={cn("mt-3 font-display text-xl font-bold", healthTone(data.health.score, data.health.hasEnoughData).cls)}>{data.health.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Financial health score</p>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">What makes up your score</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Five transparent components based on the last three months. Improve any of them to raise your score.</p>
              <div className="mt-5">
                <HealthBreakdown health={data.health} />
              </div>
            </div>
          </Card>

          <div>
            <div role="tablist" aria-label="Insight topics" className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {TOPICS.filter((t) => t.id === "all" || counts[t.id]).map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={topic === t.id}
                  onClick={() => setTopic(t.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    topic === t.id ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="text-xs tabular opacity-70">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <Card>
                <EmptyState icon={Lightbulb} title="No insights right now" description="Your finances look steady. Insights appear automatically as new patterns show up in your transactions and budgets." />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((i, idx) => (
                  <InsightCardLarge key={i.id} insight={i} index={idx} />
                ))}
              </div>
            )}
          </div>

          <Card className="p-0">
            <button
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
              aria-controls="rules-panel"
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <ShieldCheck className="size-5 text-[color:var(--teal)]" aria-hidden />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">How insights are generated</span>
                <span className="block text-[13px] text-muted-foreground">Every rule is deterministic and explainable.</span>
              </span>
              <Badge tone="outline">{RULES.length} rules</Badge>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showRules && "rotate-180")} aria-hidden />
            </button>
            {showRules && (
              <dl id="rules-panel" className="grid gap-4 border-t border-border px-5 py-5 sm:grid-cols-2">
                {RULES.map(([title, body]) => (
                  <div key={title}>
                    <dt className="text-sm font-semibold">{title}</dt>
                    <dd className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
