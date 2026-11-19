import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? "/dashboard" : "/onboarding");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="w-fit" aria-label="FinSight home">
          <Logo />
        </Link>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-center text-xs text-subtle-foreground">© {new Date().getFullYear()} FinSight. A portfolio project — not a licensed financial service.</p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border bg-background-subtle lg:block" aria-hidden>
        <div className="bg-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute -left-20 top-10 size-96 rounded-full bg-[#7c6cf0]/25 blur-[100px]" />
        <div className="absolute -right-10 bottom-10 size-80 rounded-full bg-[#14a894]/20 blur-[100px]" />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--violet)]">See your money differently</p>
          <h2 className="mt-4 max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight xl:text-[44px]">
            Clarity for every rupee you earn and spend.
          </h2>
          <ul className="mt-10 max-w-md space-y-5">
            {[
              { icon: TrendingUp, title: "Analytics that explain", body: "Trends, categories and comparisons built from your own transactions." },
              { icon: Sparkles, title: "Insights you can act on", body: "A transparent rules engine flags overspending, unusual charges and savings opportunities." },
              { icon: ShieldCheck, title: "Private by design", body: "Hashed passwords, httpOnly sessions and strict per-user data isolation." },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-[color:var(--violet)]">
                  <f.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{f.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
