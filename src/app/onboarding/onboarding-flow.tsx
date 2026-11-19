"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { BUDGETING_STYLES, CURRENCIES, FINANCIAL_GOAL_OPTIONS } from "@/lib/constants";
import { currencySymbol, formatMoney } from "@/lib/money";
import { api, errorMessage } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Icon, Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/primitives";

const STEPS = ["About you", "Money", "Goals", "Budgeting"] as const;

export function OnboardingFlow({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [name, setName] = React.useState(defaultName);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [currency, setCurrency] = React.useState("INR");
  const [income, setIncome] = React.useState("");
  const [goals, setGoals] = React.useState<string[]>([]);
  const [style, setStyle] = React.useState("flexible");
  const [starter, setStarter] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  function next() {
    if (step === 0) {
      if (name.trim().length < 2) return setNameError("Please enter at least 2 characters");
      setNameError(null);
    }
    if (step < STEPS.length - 1) go(step + 1);
    else void finish();
  }

  async function finish() {
    setSaving(true);
    const incomeNum = income ? Number(income) : null;
    try {
      await api("/api/onboarding", {
        method: "POST",
        body: {
          name: name.trim(),
          currency,
          monthlyIncome: incomeNum && incomeNum > 0 ? incomeNum : null,
          financialGoals: goals,
          budgetingStyle: style,
          createStarterBudgets: Boolean(starter && incomeNum && incomeNum > 0),
        },
      });
      toast.success(`Welcome to FinSight, ${name.trim().split(" ")[0]}!`);
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  }

  const optional = step === 1 || step === 2;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,var(--hero-glow),transparent)]" aria-hidden />
      <header className="relative flex items-center justify-between px-5 py-5 sm:px-10">
        <Logo />
        <p className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
      </header>

      <main id="main" className="relative flex flex-1 items-start justify-center px-5 pb-10 pt-4 sm:items-center">
        <div className="w-full max-w-xl">
          <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Onboarding progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined}>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full bg-primary" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
                </div>
                <p className={cn("mt-2 hidden text-xs sm:block", i <= step ? "text-foreground" : "text-subtle-foreground")}>{s}</p>
              </li>
            ))}
          </ol>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            noValidate
            className="surface overflow-hidden rounded-3xl"
          >
            <div className="relative min-h-[380px] p-6 sm:p-8">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -24 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && (
                    <div>
                      <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-[color:var(--violet)]"><Sparkles className="size-5" aria-hidden /></span>
                      <h1 className="mt-5 text-2xl font-bold tracking-tight">Let&apos;s set up FinSight for you</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">Four quick questions. Everything can be changed later in Settings.</p>
                      <Field label="What should we call you?" htmlFor="ob-name" error={nameError ?? undefined} className="mt-7">
                        <Input id="ob-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} className="h-11" />
                      </Field>
                    </div>
                  )}
                  {step === 1 && (
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Your money basics</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">We use this to format amounts and suggest sensible budgets.</p>
                      <fieldset className="mt-6">
                        <legend className="text-[13px] font-medium">Currency</legend>
                        <div role="radiogroup" className="mt-2 grid grid-cols-3 gap-2">
                          {CURRENCIES.map((c) => (
                            <button
                              type="button"
                              key={c.code}
                              role="radio"
                              aria-checked={currency === c.code}
                              onClick={() => setCurrency(c.code)}
                              className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors", currency === c.code ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
                            >
                              <span className="block text-sm font-semibold">{c.symbol} {c.code}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <Field label="Monthly take-home income" htmlFor="ob-income" optional className="mt-6" hint={income && Number(income) > 0 ? `That's ${formatMoney(Number(income) * 12, currency)} a year.` : "Helps calculate your savings ratio before you've logged income."}>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol(currency)}</span>
                          <Input id="ob-income" inputMode="decimal" placeholder="e.g. 60000" className="h-11 pl-9 tabular" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d.]/g, ""))} />
                        </div>
                      </Field>
                    </div>
                  )}
                  {step === 2 && (
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">What are you working towards?</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">Pick any that apply. We&apos;ll tailor your insights.</p>
                      <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        {FINANCIAL_GOAL_OPTIONS.map((g) => {
                          const on = goals.includes(g.id);
                          return (
                            <button
                              type="button"
                              key={g.id}
                              aria-pressed={on}
                              onClick={() => setGoals((gs) => (on ? gs.filter((x) => x !== g.id) : [...gs, g.id]))}
                              className={cn("flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors", on ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
                            >
                              <span className={cn("flex size-9 items-center justify-center rounded-lg", on ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                {on ? <Check className="size-4" aria-hidden /> : <Icon name={g.icon} className="size-4" />}
                              </span>
                              <span className="text-sm font-medium">{g.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {step === 3 && (
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">How do you like to budget?</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">There&apos;s no wrong answer — choose what feels natural.</p>
                      <div role="radiogroup" className="mt-6 grid gap-2">
                        {BUDGETING_STYLES.map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            role="radio"
                            aria-checked={style === s.id}
                            onClick={() => setStyle(s.id)}
                            className={cn("flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors", style === s.id ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
                          >
                            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", style === s.id ? "border-primary bg-primary" : "border-border-strong")}>
                              {style === s.id && <span className="size-1.5 rounded-full bg-white" />}
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{s.label}</span>
                              <span className="block text-xs text-muted-foreground">{s.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                      {Number(income) > 0 && (
                        <label htmlFor="ob-starter" className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-3.5">
                          <span>
                            <span className="block text-sm font-medium">Create starter budgets for this month</span>
                            <span className="block text-xs text-muted-foreground">Based on your income and chosen style. Easy to adjust later.</span>
                          </span>
                          <Switch id="ob-starter" checked={starter} onCheckedChange={setStarter} />
                        </label>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-background-subtle/50 px-6 py-4 sm:px-8">
              <Button type="button" variant="ghost" onClick={() => go(step - 1)} disabled={step === 0 || saving} className={step === 0 ? "invisible" : ""}>
                <ArrowLeft /> Back
              </Button>
              <div className="flex items-center gap-2">
                {optional && (
                  <Button type="button" variant="ghost" onClick={() => { if (step === 1) setIncome(""); if (step === 2) setGoals([]); go(step + 1); }}>
                    Skip
                  </Button>
                )}
                <Button type="submit" loading={saving}>
                  {step === STEPS.length - 1 ? "Go to my dashboard" : "Continue"}
                  {step < STEPS.length - 1 && <ArrowRight />}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
