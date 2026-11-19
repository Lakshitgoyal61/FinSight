"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/money";
import { Card } from "@/components/ui/primitives";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Change indicator. `goodWhen` decides the color semantics: for expenses a decrease is good.
 * Direction is always conveyed by an arrow icon + sign, never by color alone.
 */
export function Delta({
  value,
  goodWhen = "up",
  suffix,
  className,
  nullLabel = "New",
}: {
  value: number | null;
  goodWhen?: "up" | "down";
  suffix?: string;
  className?: string;
  /** Shown when there's no baseline to compare against. */
  nullLabel?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>{nullLabel}</span>;
  }
  const flat = Math.abs(value) < 0.5;
  const up = value > 0;
  const good = flat ? null : (up && goodWhen === "up") || (!up && goodWhen === "down");
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const pill = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular",
        good === null ? "bg-muted text-muted-foreground" : good ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        !suffix && className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(Math.abs(value) > 999 ? 999 : value, { signed: true })}
    </span>
  );
  if (!suffix) return pill;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      {pill}
      <span className="text-xs text-muted-foreground">{suffix}</span>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-primary/25 blur-xl" aria-hidden />
        <div className="relative flex size-12 items-center justify-center rounded-2xl border border-border bg-card-elevated text-[color:var(--violet)]">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-medium">We couldn&apos;t load this data.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? "Please check your connection and try again."}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-primary hover:underline">
          Try again
        </button>
      )}
    </Card>
  );
}

/** Staggered fade-up for page sections. Respects prefers-reduced-motion via MotionConfig. */
export function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">{children}</p>;
}
