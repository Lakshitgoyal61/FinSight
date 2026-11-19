"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { AlertTriangle, Bell, BellOff, CalendarClock, CheckCheck, Target } from "lucide-react";
import type { AnalyticsDTO, InsightsDTO, PreferencesDTO } from "@/server/data";
import type { Insight } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";

const SEEN_KEY = "finsight:seen-notifications";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

/**
 * In-app notifications derived from the insights engine (budget alerts, upcoming payments,
 * goal milestones) and filtered by the user's notification preferences.
 */
export function Notifications() {
  const { data } = useSWR<InsightsDTO>("/api/insights");
  const { data: prefData } = useSWR<{ preferences: PreferencesDTO }>("/api/user/preferences");
  const [seen, setSeen] = React.useState<Set<string>>(new Set());
  React.useEffect(() => setSeen(readSeen()), []);

  const prefs = prefData?.preferences;
  const { data: week } = useSWR<AnalyticsDTO>(prefs?.notifyWeeklySummary ? "/api/analytics?range=7d" : null);
  const money = useMoney();
  const weekly: Insight[] =
    prefs?.notifyWeeklySummary && week
      ? [
          {
            id: `weekly-${week.range.to}`,
            kind: "info",
            topic: "spending",
            priority: 0,
            title: "Your weekly summary",
            body: `Last 7 days: ${money(week.summary.expense)} spent, ${money(week.summary.income)} earned${
              week.summary.expenseChange !== null ? ` · spending ${week.summary.expenseChange >= 0 ? "up" : "down"} ${Math.abs(Math.round(week.summary.expenseChange))}% vs the week before` : ""
            }.`,
            action: { label: "Open analytics", href: "/analytics?range=7d" },
          },
        ]
      : [];
  const items = [...weekly, ...(data?.insights ?? []).filter((i) => {
    if (i.topic === "budget") return prefs?.notifyBudgetAlerts !== false && (i.kind === "alert" || i.kind === "warning");
    if (i.topic === "subscriptions") return prefs?.notifySubscriptionReminders !== false && i.id === "subs-upcoming";
    if (i.topic === "goals") return prefs?.notifyGoalMilestones !== false;
    return i.kind === "alert" || (i.kind === "warning" && i.id.startsWith("unusual"));
  })];
  const unread = items.filter((i) => !seen.has(i.id)).length;

  function markAllRead() {
    const next = new Set([...seen, ...items.map((i) => i.id)]);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-200)));
    } catch {
      /* storage unavailable — read state simply won't persist */
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative text-muted-foreground hover:text-foreground">
          <Bell className="!size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-background tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <BellOff className="mb-2 size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">Budget alerts, payment reminders and goal updates appear here.</p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto p-1.5">
            {items.map((i) => {
              const Icon = i.topic === "subscriptions" ? CalendarClock : i.topic === "goals" ? Target : AlertTriangle;
              return (
                <li key={i.id}>
                  <Link
                    href={i.action?.href ?? "/insights"}
                    className="flex gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        i.kind === "alert" ? "bg-danger-soft text-danger" : i.kind === "positive" ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        {i.title}
                        {!seen.has(i.id) && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{i.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link href="/settings#notifications" className="text-xs text-muted-foreground hover:text-foreground">
            Notification preferences
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
