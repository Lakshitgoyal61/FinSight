"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Dialog as DialogPrimitive } from "radix-ui";
import { LogOut, Menu, Monitor, Moon, MoreHorizontal, Plus, Search, Settings, Sun, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { cn, initials } from "@/lib/utils";
import { AppProvider, type AppUser, useApp } from "@/components/app-context";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Tooltip } from "@/components/ui/primitives";
import { CommandPalette } from "./command-palette";
import { MOBILE_NAV, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./nav";
import { Notifications } from "./notifications";
import { QuickActionsProvider, useQuickActions } from "./quick-actions";

export function AppShell({
  user,
  currency,
  theme,
  children,
}: {
  user: AppUser;
  currency: string;
  theme: string;
  children: React.ReactNode;
}) {
  return (
    <AppProvider user={user} currency={currency}>
      <QuickActionsProvider>
        <ThemeSync preferred={theme} />
        <ShellFrame>{children}</ShellFrame>
      </QuickActionsProvider>
    </AppProvider>
  );
}

/** Apply the theme saved in the user's preferences once per session. */
function ThemeSync({ preferred }: { preferred: string }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    const key = "finsight:theme-synced";
    try {
      if (sessionStorage.getItem(key) === preferred) return;
      sessionStorage.setItem(key, preferred);
    } catch {
      /* ignore */
    }
    setTheme(preferred);
  }, [preferred, setTheme]);
  return null;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { newTransaction } = useQuickActions();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Global keyboard shortcuts: ⌘K / Ctrl+K or "/" = command palette, N = new transaction, G + key = go to.
  React.useEffect(() => {
    let gPressed = 0;
    const map: Record<string, string> = { d: "/dashboard", t: "/transactions", a: "/analytics", b: "/budgets", g: "/goals", s: "/subscriptions", i: "/insights" };
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        newTransaction("EXPENSE");
      } else if (e.key.toLowerCase() === "g") {
        gPressed = Date.now();
      } else if (Date.now() - gPressed < 900 && map[e.key.toLowerCase()]) {
        router.push(map[e.key.toLowerCase()]!);
        gPressed = 0;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTransaction, router]);

  React.useEffect(() => setMobileNavOpen(false), [pathname]);

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--hero-glow),transparent_70%)]" aria-hidden />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-background-subtle/70 px-3 py-5 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="mb-7 px-3" aria-label="FinSight dashboard">
          <Logo />
        </Link>
        <SidebarNav pathname={pathname} />
        <div className="mt-auto">
          <SidebarFooter />
        </div>
      </aside>

      {/* Mobile slide-over nav */}
      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-popover px-3 py-5 shadow-pop data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
            <div className="mb-6 flex items-center justify-between px-3">
              <Logo />
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close navigation">
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <SidebarNav pathname={pathname} />
            <div className="mt-auto">
              <SidebarFooter />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="relative lg:pl-[248px]">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} onOpenNav={() => setMobileNavOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <MobileTabBar pathname={pathname} onAdd={() => newTransaction("EXPENSE")} onMore={() => setMobileNavOpen(true)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg border border-[color:color-mix(in_srgb,var(--violet)_30%,transparent)] bg-primary-soft"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <item.icon className={cn("relative size-[18px]", active ? "text-[color:var(--violet)]" : "")} aria-hidden />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
      <div className="my-3 h-px bg-border" />
      {SECONDARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { user } = useApp();
  return (
    <div className="space-y-3">
      {user.isDemo && (
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-[13px] font-semibold">You&apos;re exploring the demo</p>
          <p className="mt-1 text-xs text-muted-foreground">Data is sample data. Reset it anytime in Settings.</p>
        </div>
      )}
      <ThemeSwitcher />
    </div>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const persist = (t: string) => {
    setTheme(t);
    try {
      sessionStorage.setItem("finsight:theme-synced", t);
    } catch {
      /* ignore */
    }
    void api("/api/user/preferences", { method: "PATCH", body: { theme: t } }).catch(() => undefined);
  };
  const options = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-background-subtle p-0.5">
      {options.map((o) => {
        const active = mounted && theme === o.id;
        return (
          <Tooltip key={o.id} content={`${o.label} theme`}>
            <button
              role="radio"
              aria-checked={active}
              aria-label={`${o.label} theme`}
              onClick={() => persist(o.id)}
              className={cn(
                "flex h-7 items-center justify-center rounded-md transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <o.icon className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function TopBar({ onOpenPalette, onOpenNav }: { onOpenPalette: () => void; onOpenNav: () => void }) {
  const { newTransaction } = useQuickActions();
  return (
    <header className="glass sticky top-0 z-20 border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onOpenNav}>
          <Menu />
        </Button>
        <Link href="/dashboard" className="lg:hidden" aria-label="FinSight dashboard">
          <Logo withText={false} />
        </Link>

        <button
          onClick={onOpenPalette}
          className="group hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-background-subtle/70 px-3 text-sm text-subtle-foreground transition-colors hover:border-border-strong hover:text-muted-foreground sm:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium">Ctrl K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground sm:hidden" aria-label="Search" onClick={onOpenPalette}>
            <Search className="!size-[18px]" />
          </Button>
          <Notifications />
          <Button className="ml-1 hidden sm:inline-flex" onClick={() => newTransaction("EXPENSE")}>
            <Plus /> Add transaction
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const { user } = useApp();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 flex size-10 items-center justify-center rounded-full border border-border bg-[linear-gradient(135deg,#7c6cf0,#3987e5)] text-[13px] font-semibold text-white transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={`Account menu for ${user.name}`}
        >
          {initials(user.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" disabled={signingOut} onSelect={(e) => { e.preventDefault(); void signOut(); }}>
          <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileTabBar({ pathname, onAdd, onMore }: { pathname: string; onAdd: () => void; onMore: () => void }) {
  const left = MOBILE_NAV.slice(0, 2);
  const right = MOBILE_NAV.slice(2, 3);
  const item = (n: NavItem) => {
    const active = isActive(pathname, n.href);
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-medium", active ? "text-foreground" : "text-muted-foreground")}
      >
        <n.icon className={cn("size-5", active && "text-[color:var(--violet)]")} aria-hidden />
        {n.label === "Savings Goals" ? "Goals" : n.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Primary" className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        {left.map(item)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={onAdd}
            aria-label="Add transaction"
            className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_-8px_var(--primary)] ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>
        {right.map(item)}
        <button onClick={onMore} className="flex flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-medium text-muted-foreground">
          <MoreHorizontal className="size-5" aria-hidden />
          More
        </button>
      </div>
    </nav>
  );
}
