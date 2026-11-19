"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowDownLeft, ArrowUpRight, CornerDownLeft, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav";
import { useQuickActions } from "./quick-actions";

type Command = { id: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string }>; run: () => void; keywords?: string };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { newTransaction } = useQuickActions();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  const commands = React.useMemo<Command[]>(() => {
    const close = (fn: () => void) => () => {
      onOpenChange(false);
      fn();
    };
    return [
      { id: "new-expense", label: "Add expense", hint: "N", icon: ArrowUpRight, run: close(() => newTransaction("EXPENSE")), keywords: "new create spend" },
      { id: "new-income", label: "Add income", icon: ArrowDownLeft, run: close(() => newTransaction("INCOME")), keywords: "new create salary" },
      ...[...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => ({
        id: n.href,
        label: `Go to ${n.label}`,
        hint: n.shortcut,
        icon: n.icon,
        run: close(() => router.push(n.href)),
      })),
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        run: close(() => setTheme(resolvedTheme === "dark" ? "light" : "dark")),
        keywords: "appearance mode",
      },
    ];
  }, [newTransaction, onOpenChange, resolvedTheme, router, setTheme]);

  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q)) : commands;
  const searchItem: Command | null = q
    ? {
        id: "search",
        label: `Search transactions for “${query.trim()}”`,
        icon: Search,
        run: () => {
          onOpenChange(false);
          router.push(`/transactions?q=${encodeURIComponent(query.trim())}`);
        },
      }
    : null;
  const items = searchItem ? [...filtered, searchItem] : filtered;

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);
  React.useEffect(() => setActive(0), [query]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(3,6,18,0.55)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages, actions and transactions</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, actions, or transactions…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle-foreground"
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
            />
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">Esc</kbd>
          </div>
          <ul ref={listRef} id="command-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No matching commands</li>}
            {items.map((c, i) => (
              <li
                key={c.id}
                id={`cmd-${c.id}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={c.run}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  i === active ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                <c.icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <kbd className="text-[11px] text-subtle-foreground">{c.hint}</kbd>}
                {i === active && <CornerDownLeft className="size-3.5 text-subtle-foreground" aria-hidden />}
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
