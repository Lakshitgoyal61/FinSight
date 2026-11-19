"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryColor } from "@/lib/constants";
import { formatAxis } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useApp, useMoney } from "@/components/app-context";

// ---------------------------------------------------------------- shared bits

type TooltipItem = {
  name?: string | number;
  value?: number | string | null;
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};
type TooltipProps = { active?: boolean; payload?: readonly TooltipItem[]; label?: string | number };

function useAxisFormatter() {
  const { currency } = useApp();
  return React.useCallback((v: number) => formatAxis(v, currency), [currency]);
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--chart-axis)", fontSize: 11.5 },
} as const;

export function ChartTooltipBox({
  title,
  rows,
  footer,
}: {
  title?: React.ReactNode;
  rows: { label: string; value: string; color?: string; dashed?: boolean }[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-w-44 rounded-xl border border-border bg-popover/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur">
      {title && <p className="mb-1.5 font-medium text-foreground">{title}</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              {r.color && (
                <span
                  className={cn("inline-block h-2 w-2 rounded-sm", r.dashed && "h-0.5 w-3 rounded-none")}
                  style={{ background: r.color }}
                  aria-hidden
                />
              )}
              {r.label}
            </span>
            <span className="font-semibold tabular text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-border pt-1.5 text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className={cn("inline-block", i.dashed ? "h-0 w-3.5 border-t-2 border-dashed" : "size-2.5 rounded-[3px]")}
            style={i.dashed ? { borderColor: i.color } : { background: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Screen-reader (and optional visible) table for every chart — data is never color/shape only. */
export function ChartTable({
  caption,
  columns,
  rows,
  visible = false,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  visible?: boolean;
}) {
  return (
    // contain:strict keeps the visually-hidden table from widening the mobile layout viewport.
    <div className={visible ? "max-h-80 overflow-auto rounded-lg border border-border" : "sr-only [contain:strict]"}>
      <table className="w-full text-left text-sm">
        <caption className={visible ? "sr-only" : undefined}>{caption}</caption>
        <thead className="sticky top-0 bg-card">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-3 py-1.5 tabular", j > 0 && "text-right")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Spending curve (dashboard)

export type CurvePoint = { day: number; thisMonth: number | null; lastMonth: number; daily: number | null };

export function SpendingCurveChart({ data, monthLabel, height = 260 }: { data: CurvePoint[]; monthLabel: string; height?: number }) {
  const money = useMoney();
  const axis = useAxisFormatter();
  const today = [...data].reverse().find((d) => d.thisMonth !== null);
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-expense)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-expense)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...axisProps} tickFormatter={axis} width={48} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={(p: TooltipProps) =>
              p.active && p.payload?.length ? (
                <ChartTooltipBox
                  title={`Day ${p.label} · ${monthLabel}`}
                  rows={[
                    ...(p.payload[0]?.payload?.thisMonth != null
                      ? [{ label: "This month (total)", value: money(Number(p.payload[0]!.payload!.thisMonth)), color: "var(--chart-expense)" }]
                      : []),
                    { label: "Last month (total)", value: money(Number(p.payload[0]?.payload?.lastMonth ?? 0)), color: "var(--chart-axis)", dashed: true },
                    ...(p.payload[0]?.payload?.daily != null ? [{ label: "Spent that day", value: money(Number(p.payload[0]!.payload!.daily)) }] : []),
                  ]}
                />
              ) : null
            }
          />
          <Area type="monotone" dataKey="lastMonth" stroke="var(--chart-axis)" strokeDasharray="4 4" strokeWidth={1.5} fill="transparent" dot={false} activeDot={false} isAnimationActive={false} />
          <Area
            type="monotone"
            dataKey="thisMonth"
            stroke="var(--chart-expense)"
            strokeWidth={2}
            fill="url(#curveFill)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--chart-expense)" }}
            connectNulls={false}
          />
          {today && <ReferenceLine x={today.day} stroke="var(--border-strong)" strokeDasharray="2 3" />}
        </AreaChart>
      </ResponsiveContainer>
      <ChartTable
        caption={`Cumulative spending by day, ${monthLabel} vs previous month`}
        columns={["Day", "This month", "Last month"]}
        rows={data.map((d) => [d.day, d.thisMonth === null ? "—" : money(d.thisMonth), money(d.lastMonth)])}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Income vs expense bars

export function IncomeExpenseBars({
  data,
  height = 260,
}: {
  data: { label: string; income: number; expense: number }[];
  height?: number;
}) {
  const money = useMoney();
  const axis = useAxisFormatter();
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={axis} width={48} />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            content={(p: TooltipProps) => {
              if (!p.active || !p.payload?.length) return null;
              const row = p.payload[0]!.payload as { income: number; expense: number };
              const net = row.income - row.expense;
              return (
                <ChartTooltipBox
                  title={String(p.label)}
                  rows={[
                    { label: "Income", value: money(row.income), color: "var(--chart-income)" },
                    { label: "Expenses", value: money(row.expense), color: "var(--chart-expense)" },
                  ]}
                  footer={
                    <span className="flex justify-between">
                      <span>Net</span>
                      <span className={cn("font-semibold tabular", net >= 0 ? "text-success" : "text-danger")}>{money(net, { signed: true })}</span>
                    </span>
                  }
                />
              );
            }}
          />
          <Bar dataKey="income" name="Income" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name="Expenses" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
      <ChartTable caption="Income and expenses by period" columns={["Period", "Income", "Expenses"]} rows={data.map((d) => [d.label, money(d.income), money(d.expense)])} />
    </div>
  );
}

// ---------------------------------------------------------------- Category donut

export type Slice = { category: string; label: string; amount: number; share: number };

function sliceColor(category: string) {
  return category === "__other" ? "var(--cat-other)" : categoryColor(category);
}

export function CategoryDonut({
  data,
  total,
  centerLabel = "Spent",
  size = 190,
  showLegend = true,
}: {
  data: Slice[];
  total: number;
  centerLabel?: string;
  size?: number;
  showLegend?: boolean;
}) {
  const money = useMoney();
  const [active, setActive] = React.useState<number | null>(null);
  const focused = active !== null ? data[active] : null;
  return (
    <div className="relative @container">
    <div className={cn("flex flex-col items-center gap-5", showLegend && "@[26rem]:flex-row @[26rem]:items-center")}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((s, i) => (
                <Cell key={s.category} fill={sliceColor(s.category)} opacity={active === null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">{focused ? focused.label : centerLabel}</span>
          <span className="font-display text-lg font-bold tabular">{money(focused ? focused.amount : total, { compact: true })}</span>
          {focused && <span className="text-[11px] text-muted-foreground tabular">{focused.share.toFixed(0)}%</span>}
        </div>
      </div>
      {showLegend && (
        <ul className="w-full min-w-0 space-y-2">
          {data.map((s, i) => (
            <li
              key={s.category}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn("flex items-center gap-2.5 rounded-md text-[13px] transition-opacity", active !== null && active !== i && "opacity-50")}
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: sliceColor(s.category) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="tabular font-medium">{money(s.amount, { compact: true })}</span>
              <span className="w-10 text-right text-xs tabular text-subtle-foreground">{s.share.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      )}
      <ChartTable caption="Spending by category" columns={["Category", "Amount", "Share"]} rows={data.map((s) => [s.label, money(s.amount), `${s.share.toFixed(1)}%`])} />
    </div>
    </div>
  );
}

// ---------------------------------------------------------------- Simple single-series bars

export function SimpleBars({
  data,
  dataKey,
  labelKey,
  height = 200,
  highlightLast = false,
  color = "var(--chart-expense)",
  seriesLabel = "Spent",
  valueSuffix,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  labelKey: string;
  height?: number;
  highlightLast?: boolean;
  color?: string;
  seriesLabel?: string;
  valueSuffix?: string;
}) {
  const money = useMoney();
  const axis = useAxisFormatter();
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={labelKey} {...axisProps} />
          <YAxis {...axisProps} tickFormatter={axis} width={44} />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            content={(p: TooltipProps) =>
              p.active && p.payload?.length ? (
                <ChartTooltipBox
                  title={String(p.label)}
                  rows={[{ label: seriesLabel, value: `${money(Number(p.payload[0]!.value ?? 0))}${valueSuffix ?? ""}`, color }]}
                />
              ) : null
            }
          />
          <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={34}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={highlightLast ? (i === data.length - 1 ? 1 : 0.45) : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartTable caption={seriesLabel} columns={["Period", seriesLabel]} rows={data.map((d) => [String(d[labelKey]), money(Number(d[dataKey]))])} />
    </div>
  );
}

// ---------------------------------------------------------------- Trend area (analytics)

export function TrendArea({
  data,
  height = 300,
}: {
  data: { label: string; income: number; expense: number; net: number }[];
  height?: number;
}) {
  const money = useMoney();
  const axis = useAxisFormatter();
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-income)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-income)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-expense)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-expense)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axisProps} tickFormatter={axis} width={48} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={(p: TooltipProps) => {
              if (!p.active || !p.payload?.length) return null;
              const row = p.payload[0]!.payload as { income: number; expense: number; net: number };
              return (
                <ChartTooltipBox
                  title={String(p.label)}
                  rows={[
                    { label: "Income", value: money(row.income), color: "var(--chart-income)" },
                    { label: "Expenses", value: money(row.expense), color: "var(--chart-expense)" },
                  ]}
                  footer={
                    <span className="flex justify-between">
                      <span>Net</span>
                      <span className={cn("font-semibold tabular", row.net >= 0 ? "text-success" : "text-danger")}>{money(row.net, { signed: true })}</span>
                    </span>
                  }
                />
              );
            }}
          />
          <Area type="monotone" dataKey="income" stroke="var(--chart-income)" strokeWidth={2} fill="url(#incFill)" dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
          <Area type="monotone" dataKey="expense" stroke="var(--chart-expense)" strokeWidth={2} fill="url(#expFill)" dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- Savings rate line

export function SavingsRateLine({ data, height = 220 }: { data: { label: string; savingsRate: number | null }[]; height?: number }) {
  const points = data.map((d) => ({ label: d.label, rate: d.savingsRate === null ? null : Math.round(d.savingsRate * 10) / 10 }));
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v: number) => `${v}%`} width={40} />
          <ReferenceLine y={20} stroke="var(--chart-income)" strokeDasharray="4 4" label={{ value: "20% target", position: "insideTopRight", fill: "var(--chart-axis)", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={(p: TooltipProps) =>
              p.active && p.payload?.length ? (
                <ChartTooltipBox
                  title={String(p.label)}
                  rows={[{ label: "Savings rate", value: p.payload[0]!.value === null ? "No income" : `${p.payload[0]!.value}%`, color: "var(--blue)" }]}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey="rate" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--blue)", stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <ChartTable caption="Savings rate by month" columns={["Month", "Savings rate"]} rows={points.map((p) => [p.label, p.rate === null ? "—" : `${p.rate}%`])} />
    </div>
  );
}

// ---------------------------------------------------------------- Sparkline

export function Sparkline({ values, color = "var(--violet)", height = 36 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = React.useId().replace(/:/g, "");
  return (
    <div style={{ height }} className="w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
