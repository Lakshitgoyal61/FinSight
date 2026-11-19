import { ArrowDownLeft, ArrowUpRight, Car, PiggyBank, ShoppingBag, Sparkles, Utensils, Wallet } from "lucide-react";

/**
 * Illustrative product composition for the landing page (static marketing artwork,
 * not connected to any account). The real dashboard computes every value from the database.
 */
export function ProductPreview() {
  const kpis = [
    { label: "Total balance", value: "₹1,24,580", delta: "+8.2%", icon: Wallet, color: "#8b7cf6" },
    { label: "Income", value: "₹76,000", delta: "+4.1%", icon: ArrowDownLeft, color: "#14a894" },
    { label: "Spent", value: "₹41,260", delta: "−6.3%", icon: ArrowUpRight, color: "#8b7cf6" },
    { label: "Savings", value: "₹1,62,000", delta: "+₹22K", icon: PiggyBank, color: "#3987e5" },
  ];
  const donut = [
    { label: "Food & Dining", pct: 32, color: "#d95926" },
    { label: "Shopping", pct: 26, color: "#9085e9" },
    { label: "Transport", pct: 18, color: "#3987e5" },
    { label: "Other", pct: 24, color: "#6b7493" },
  ];
  let offset = 0;
  const r = 34;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative mx-auto w-full max-w-5xl" aria-hidden>
      <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_30%,rgba(124,108,240,0.35),transparent_70%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0b1129] p-2 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ml-3 h-5 flex-1 max-w-xs rounded-md bg-white/5" />
        </div>
        <div className="grid gap-3 rounded-2xl bg-[#060a18] p-3 text-[#e9ecf8] sm:p-4 md:grid-cols-[150px_1fr]">
          <div className="hidden flex-col gap-1.5 md:flex">
            {["Dashboard", "Transactions", "Analytics", "Budgets", "Goals", "Subscriptions", "Insights"].map((n, i) => (
              <div key={n} className={`rounded-lg px-3 py-2 text-[11px] ${i === 0 ? "bg-[#8b7cf6]/15 text-white ring-1 ring-[#8b7cf6]/30" : "text-[#98a1c0]"}`}>{n}</div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-white/[0.08] bg-[#0d1430] p-3">
                  <div className="flex items-center gap-2 text-[10.5px] text-[#98a1c0]">
                    <span className="flex size-5 items-center justify-center rounded-md" style={{ background: `${k.color}26`, color: k.color }}>
                      <k.icon className="size-3" />
                    </span>
                    {k.label}
                  </div>
                  <p className="mt-2 font-display text-[15px] font-bold sm:text-lg">{k.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#3ccf72]">{k.delta}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2.5 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-xl border border-white/[0.08] bg-[#0d1430] p-3">
                <p className="text-[11px] font-semibold">Spending overview</p>
                <svg viewBox="0 0 400 120" className="mt-2 h-28 w-full">
                  <defs>
                    <linearGradient id="pp-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#8b7cf6" stopOpacity="0.45" />
                      <stop offset="1" stopColor="#8b7cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[30, 60, 90].map((y) => (
                    <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="rgba(148,163,214,0.1)" />
                  ))}
                  <path d="M0 100 C40 92 60 70 100 74 S160 40 200 52 S260 30 300 36 S360 18 400 14" fill="none" stroke="#6b7493" strokeDasharray="4 4" strokeWidth="1.5" />
                  <path d="M0 104 C40 96 60 84 100 80 S160 56 200 60 S250 34 290 30 L290 120 L0 120 Z" fill="url(#pp-fill)" />
                  <path d="M0 104 C40 96 60 84 100 80 S160 56 200 60 S250 34 290 30" fill="none" stroke="#8b7cf6" strokeWidth="2.5" />
                  <circle cx="290" cy="30" r="5" fill="#8b7cf6" stroke="#0d1430" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#0d1430] p-3">
                <p className="text-[11px] font-semibold">Spending breakdown</p>
                <div className="mt-2 flex items-center gap-3">
                  <svg viewBox="0 0 90 90" className="size-20 shrink-0 -rotate-90">
                    {donut.map((d) => {
                      const len = (d.pct / 100) * c;
                      const el = <circle key={d.label} cx="45" cy="45" r={r} fill="none" stroke={d.color} strokeWidth="11" strokeDasharray={`${len - 2} ${c - len + 2}`} strokeDashoffset={-offset} />;
                      offset += len;
                      return el;
                    })}
                  </svg>
                  <ul className="space-y-1 text-[10px] text-[#98a1c0]">
                    {donut.map((d) => (
                      <li key={d.label} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: d.color }} /> {d.label} <span className="ml-auto pl-2 text-white">{d.pct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-[#0d1430] p-3">
                <p className="text-[11px] font-semibold">Recent transactions</p>
                {[
                  { n: "Swiggy", c: "Food & Dining", a: "−₹420", I: Utensils, col: "#d95926" },
                  { n: "Myntra", c: "Shopping", a: "−₹2,499", I: ShoppingBag, col: "#9085e9" },
                  { n: "Uber", c: "Transport", a: "−₹320", I: Car, col: "#3987e5" },
                ].map((t) => (
                  <div key={t.n} className="mt-2 flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${t.col}26`, color: t.col }}><t.I className="size-3.5" /></span>
                    <div className="flex-1"><p className="text-[11px] font-medium">{t.n}</p><p className="text-[9.5px] text-[#98a1c0]">{t.c}</p></div>
                    <p className="text-[11px] font-semibold">{t.a}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#8b7cf6]/30 bg-[linear-gradient(135deg,rgba(124,108,240,0.18),rgba(13,20,48,1))] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold"><Sparkles className="size-3.5 text-[#a69bff]" /> Smart insight</p>
                <p className="mt-2 text-[12px] font-semibold">Food spending is up 18% this month</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-[#98a1c0]">You&apos;ve spent ₹1,240 more on food delivery than at this point last month. Trimming it by 20% saves ₹15,600 a year.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
