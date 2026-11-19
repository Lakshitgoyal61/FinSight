import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Database,
  FileUp,
  Fingerprint,
  Gauge,
  KeyRound,
  Lock,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/icons";
import { DemoButton } from "@/components/marketing/demo-button";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: BarChart3, title: "Analytics that explain", body: "Trends, category breakdowns, weekday patterns and period-over-period comparisons — all from your own records.", color: "#3987e5" },
  { icon: PiggyBank, title: "Budgets that keep pace", body: "Category limits with live utilisation, month-end projections and a safe-to-spend daily allowance.", color: "#14a894" },
  { icon: Target, title: "Goals you actually reach", body: "See exactly how much to save each month and whether you're on track for every target date.", color: "#9085e9" },
  { icon: Repeat, title: "Subscriptions under control", body: "One list of every recurring charge, with reminders and one-tap payment recording.", color: "#d55181" },
  { icon: Gauge, title: "A health score you can trust", body: "A transparent 0–100 score that shows every point it awards — no black box.", color: "#c98500" },
  { icon: FileUp, title: "Bring your history", body: "Import transactions from CSV with row-level validation, and export everything whenever you like.", color: "#d95926" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const appHref = user ? (user.onboarded ? "/dashboard" : "/onboarding") : null;

  return (
    <div className="relative overflow-x-clip">
      {/* Nav */}
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="FinSight home"><Logo /></Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#analytics" className="hover:text-foreground">Analytics</a>
            <a href="#insights" className="hover:text-foreground">Insights</a>
            <a href="#security" className="hover:text-foreground">Security</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {appHref ? (
              <Button asChild><Link href={appHref}>Open app <ArrowRight /></Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
                <Button asChild><Link href="/signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative px-4 pt-16 sm:px-6 sm:pt-24">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_50%_at_50%_20%,black,transparent)]" aria-hidden />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_30%,var(--hero-glow),transparent_70%)]" aria-hidden />
          <div className="relative mx-auto max-w-4xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="size-3.5 text-[color:var(--violet)]" aria-hidden /> Personal finance, explained by your own data
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-balance font-display text-[42px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-7xl">
                See your money <span className="brand-text">differently.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                FinSight turns everyday transactions into clear analytics, realistic budgets and insights you can act on — built for students and young professionals who want to feel in control.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={appHref ?? "/signup"}>{appHref ? "Go to dashboard" : "Create free account"} <ArrowRight /></Link>
                </Button>
                {!appHref && <DemoButton size="lg" variant="secondary" className="w-full sm:w-auto" />}
              </div>
              <p className="mt-4 text-xs text-subtle-foreground">No bank login required · Your data stays in your account · INR-first, multi-currency display</p>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="relative mt-16 sm:mt-20">
            <ProductPreview />
          </Reveal>
        </section>

        {/* Stats strip */}
        <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
          <dl className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card/50 p-6 text-center sm:grid-cols-4">
            {[
              ["13", "purpose-built screens"],
              ["10", "insight rules, fully explainable"],
              ["5", "health-score components"],
              ["0", "third parties with your data"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="block font-display text-3xl font-bold">{n}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-[color:var(--violet)]">Everything in one place</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">A complete money toolkit, without the clutter</h2>
            <p className="mt-4 text-muted-foreground">Each feature is designed around a single question you have about your money — and answers it at a glance.</p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="surface group h-full rounded-2xl p-6 transition-colors hover:border-border-strong">
                  <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: `${f.color}22`, color: f.color }}>
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Analytics showcase */}
        <section id="analytics" className="scroll-mt-20 border-y border-border bg-background-subtle/60 py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold text-[color:var(--blue)]">Analytics</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Know where it goes. Notice when it changes.</h2>
              <p className="mt-4 text-muted-foreground">Switch between 7 days and a full year in one tap. Every chart compares against the previous period, so trends are obvious — not hidden.</p>
              <ul className="mt-8 space-y-4">
                {[
                  "Income vs expense trends with daily, weekly or monthly grouping",
                  "Category breakdowns with change vs the previous period",
                  "Weekday patterns, top merchants and payment methods",
                  "Accessible table view for every chart",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--blue)]/15 text-[color:var(--blue)]">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="surface rounded-2xl p-6" aria-hidden>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Income vs expenses</p>
                  <div className="flex gap-1 rounded-lg border border-border p-0.5 text-[11px]">
                    {["7D", "30D", "3M", "6M", "YTD"].map((r, i) => (
                      <span key={r} className={`rounded-md px-2 py-1 ${i === 3 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{r}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex h-48 items-end gap-3">
                  {[[62, 44], [64, 51], [70, 47], [66, 58], [72, 49], [78, 42]].map(([inc, exp], i) => (
                    <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
                      <div className="w-full max-w-4 rounded-t bg-[color:var(--chart-income)]" style={{ height: `${inc}%` }} />
                      <div className="w-full max-w-4 rounded-t bg-[color:var(--chart-expense)]" style={{ height: `${exp}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  {["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((m) => <span key={m} className="flex-1 text-center">{m}</span>)}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
                  <div><p className="text-xs text-muted-foreground">Savings ratio</p><p className="font-display text-lg font-bold">41%</p></div>
                  <div><p className="text-xs text-muted-foreground">Top category</p><p className="font-display text-lg font-bold">Rent</p></div>
                  <div><p className="text-xs text-muted-foreground">Daily avg</p><p className="font-display text-lg font-bold">₹1,480</p></div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Insights showcase */}
        <section id="insights" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-[color:var(--teal)]">Financial insights engine</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">Advice grounded in your numbers, not guesswork</h2>
            <p className="mt-4 text-muted-foreground">A transparent rules engine reads your transactions, budgets and goals, then tells you what changed and what to do next. Every insight shows the numbers behind it.</p>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { icon: TrendingUp, tone: "#c98500", tag: "Heads up", title: "Food & Dining is up 18%", body: "₹1,240 more than at this point last month. Most of it happened on weekends." },
              { icon: BellRing, tone: "#3987e5", tag: "Reminder", title: "3 payments in the next 7 days", body: "Netflix, Spotify and iCloud+ will charge ₹987 in total this week." },
              { icon: TrendingDown, tone: "#3ccf72", tag: "Good news", title: "Your savings ratio improved", body: "You're keeping 41% of your income this month, up from 33% last month." },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.06}>
                <div className="surface h-full rounded-2xl p-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `${c.tone}22`, color: c.tone }}>
                    <c.icon className="size-3.5" aria-hidden /> {c.tag}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{c.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 px-4 pb-24 sm:px-6">
          <div className="surface relative mx-auto max-w-6xl overflow-hidden rounded-3xl p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-[#14a894]/15 blur-3xl" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_1.3fr]">
              <Reveal>
                <ShieldCheck className="size-9 text-[color:var(--teal)]" aria-hidden />
                <h2 className="mt-4 text-3xl font-bold tracking-tight">Private by design</h2>
                <p className="mt-4 text-muted-foreground">Financial data deserves serious protection. FinSight is built with security fundamentals from the first line of code.</p>
              </Reveal>
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  { icon: KeyRound, title: "Hashed passwords", body: "bcrypt hashing — passwords are never stored or logged in plain text." },
                  { icon: Lock, title: "Secure sessions", body: "Opaque, revocable, httpOnly session cookies with SameSite protection." },
                  { icon: Fingerprint, title: "Strict data isolation", body: "Every query is authorised server-side and scoped to your account." },
                  { icon: Database, title: "You own your data", body: "Export everything as JSON or CSV, or delete your account permanently." },
                ].map((s, i) => (
                  <Reveal key={s.title} delay={i * 0.05}>
                    <div className="flex gap-3">
                      <s.icon className="mt-0.5 size-5 shrink-0 text-[color:var(--violet)]" aria-hidden />
                      <div>
                        <h3 className="text-sm font-semibold">{s.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#2a1f7a_0%,#14306b_55%,#0b4f4a_100%)] px-6 py-14 text-center text-white sm:px-12">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
            <h2 className="relative text-balance text-3xl font-bold tracking-tight sm:text-4xl">Start seeing your money differently</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/75">Create an account in under a minute, or explore a fully populated demo first.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-[#1b1b4b] shadow-none hover:bg-white/90">
                <Link href={appHref ?? "/signup"}>{appHref ? "Open dashboard" : "Get started free"} <ArrowRight /></Link>
              </Button>
              {!appHref && <DemoButton size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" />}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">See your money differently. A personal finance management platform built as a UI/UX and full-stack engineering project.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <a href="#security" className="hover:text-foreground">Security</a>
            <Link href="/signup" className="hover:text-foreground">Create account</Link>
          </nav>
        </div>
        <p className="border-t border-border py-5 text-center text-xs text-subtle-foreground">© {new Date().getFullYear()} FinSight. Not a bank or licensed financial adviser.</p>
      </footer>
    </div>
  );
}
