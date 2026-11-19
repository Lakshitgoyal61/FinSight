"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertOctagon, AlertTriangle, ArrowRight, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { Insight } from "@/lib/finance/insights";
import type { HealthScore } from "@/lib/finance/health";
import { cn } from "@/lib/utils";

const KIND = {
  alert: { icon: AlertOctagon, cls: "bg-danger-soft text-danger", label: "Alert" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning", label: "Heads up" },
  positive: { icon: TrendingUp, cls: "bg-success-soft text-success", label: "Good news" },
  tip: { icon: Lightbulb, cls: "bg-primary-soft text-[color:var(--violet)]", label: "Tip" },
  info: { icon: Info, cls: "bg-[color-mix(in_srgb,var(--blue)_14%,transparent)] text-[color:var(--blue)]", label: "Insight" },
} as const;

export function InsightRow({ insight, compact = false }: { insight: Insight; compact?: boolean }) {
  const k = KIND[insight.kind];
  return (
    <div className={cn("group flex gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-accent/60", compact && "p-2.5")}>
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", k.cls)}>
        <k.icon className="size-[17px]" aria-hidden />
        <span className="sr-only">{k.label}:</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold leading-snug">{insight.title}</p>
        <p className={cn("mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground", compact && "line-clamp-2")}>{insight.body}</p>
        {insight.action && (
          <Link href={insight.action.href} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--violet)] hover:underline">
            {insight.action.label} <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

export function InsightCardLarge({ insight, index = 0 }: { insight: Insight; index?: number }) {
  const k = KIND[insight.kind];
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className="surface flex flex-col rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold", k.cls)}>
          <k.icon className="size-3.5" aria-hidden /> {k.label}
        </span>
        {insight.metric && (
          <div className="text-right">
            <p className="font-display text-lg font-bold leading-none tabular">{insight.metric.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{insight.metric.label}</p>
          </div>
        )}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold leading-snug">{insight.title}</h3>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-foreground">{insight.body}</p>
      {insight.action && (
        <Link href={insight.action.href} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--violet)] hover:underline">
          {insight.action.label} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </motion.article>
  );
}

export function healthTone(score: number, hasData = true) {
  if (!hasData) return { color: "var(--chart-axis)", cls: "text-muted-foreground" };
  if (score >= 80) return { color: "var(--success)", cls: "text-success" };
  if (score >= 65) return { color: "var(--teal)", cls: "text-[color:var(--teal)]" };
  if (score >= 45) return { color: "var(--warning)", cls: "text-warning" };
  return { color: "var(--danger)", cls: "text-danger" };
}

export function HealthRing({ health, size = 132, stroke = 11 }: { health: HealthScore; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = health.hasEnoughData ? health.score / 100 : 0;
  const tone = healthTone(health.score, health.hasEnoughData);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Financial health score ${health.score} out of 100, ${health.label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular">{health.hasEnoughData ? health.score : "—"}</span>
        <span className="text-[11px] text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}

export function HealthBreakdown({ health }: { health: HealthScore }) {
  return (
    <ul className="space-y-3">
      {health.components.map((c) => {
        const pct = (c.score / c.max) * 100;
        return (
          <li key={c.key}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium">{c.label}</span>
              <span className="tabular text-muted-foreground">
                {c.score.toFixed(c.score % 1 ? 1 : 0)} / {c.max}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: healthTone(pct).color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}
