# FinSight — See your money differently.

FinSight is a full-stack personal finance management platform for students and young professionals. It turns everyday transactions into clear analytics, realistic budgets, savings goals, subscription tracking and **explainable** financial insights — all computed from the user's own data in a real database.

> Built an advanced UI/UX + software-engineering project: Next.js App Router, TypeScript, Prisma + SQLite, session auth, Recharts, Framer Motion, Vitest and Playwright.

---

## Contents

- [Quick start](#quick-start)
- [Demo account](#demo-account)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Database design](#database-design)
- [Insights engine & health score](#insights-engine--health-score)
- [UI/UX design decisions](#uiux-design-decisions)
- [Security](#security)
- [Testing](#testing)
- [Screenshots for GitHub](#screenshots-for-github)
- [Known limitations](#known-limitations)

---

## Quick start

**Requirements:** Node.js 20+ (tested on Node 24 LTS) and npm.

### Windows: one double-click

Double-click **`Start FinSight.bat`** in the project folder. On first run it installs dependencies, creates the database with demo data and builds the app; afterwards it starts in seconds and opens `http://localhost:3000` in your browser. Keep the window open while using FinSight.

### Any OS: terminal

```bash
cd finsight
cp .env.example .env          # Windows: copy .env.example .env
npm install                   # also runs `prisma generate`
npm run setup                 # applies migrations + seeds the demo account
npm run dev                   # http://localhost:3000
```

Production mode:

```bash
npm run build
npm run start                 # add INSECURE_COOKIES=1 when serving over plain http on a non-localhost host
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite file (relative to `prisma/schema.prisma`) |
| `SESSION_MAX_AGE_DAYS` | `30` | Session lifetime |
| `INSECURE_COOKIES` | unset | Set to `1` to allow session cookies over plain `http` in production mode (local demos only) |

### Database commands

| Command | What it does |
|---|---|
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply existing migrations (CI / production) |
| `npm run db:seed` | (Re)create the demo account with fresh, date-relative sample data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:cleanup-tests` | Delete accounts created by the E2E suite (`*@example.com`) |

---

## Demo account

| Email | Password |
|---|---|
| `demo@finsight.app` | `Demo@1234` |

Or click **"Explore the live demo"** on the landing or login page. The demo contains ~7 months of realistic Indian-context data (salary, freelance income, rent, groceries, food delivery, transport, a trip, an unusual large purchase), 7 budgets × 3 months, 4 savings goals and 7 subscriptions. Data is generated **relative to today**, so the dashboard always looks current. Reset it any time in **Settings → Your data → Reset demo**.

---

## Features

**13 screens:** Landing · Sign up · Login · Onboarding · Dashboard · Transactions · Analytics · Budgets · Savings Goals · Subscriptions · Insights · Settings · Profile.

| Area | What works |
|---|---|
| **Auth** | Register, login, logout, one-click demo, protected routes, session revocation on password change, rate-limited login |
| **Onboarding** | 4 steps (name, currency + income, goals, budgeting style); optional steps skippable; can generate starter budgets from income × style |
| **Dashboard** | Balance / income / spending / savings KPIs with change vs the same days last month; cumulative spending curve vs last month; 6-month income vs expenses; category donut; last-7-days bars; recent transactions; explainable health score; smart insights; goals; budget utilisation; upcoming bills |
| **Transactions** | Full CRUD, detail view, duplicate, bulk delete, **undo** after delete, debounced search, filters (type, category, date presets + custom range), sort by date/amount, pagination with page size — all **URL-synced** (shareable, back-button friendly) |
| **CSV** | Import with **dry-run preview** and row-level errors (accepts Indian `DD/MM/YYYY` dates, category labels, `1,450.50` amounts); export honours current filters; downloadable template |
| **Budgets** | Monthly per-category limits, month navigation, copy from last month, configurable alert threshold, states *On track / At risk / Approaching / Over budget*, month-end projection and safe-to-spend per day, "spending without a budget" nudges |
| **Goals** | Templates, icon/colour, target date, starting amount, deposits/withdrawals, contribution history, on-track/behind detection, monthly amount needed, automatic completion |
| **Subscriptions** | Monthly/yearly billing, monthly-equivalent totals, 30-day timeline, overdue detection, **Mark paid** (creates a linked expense and advances the next date atomically), cancel/reactivate, payment history chart |
| **Analytics** | 7D / 30D / 3M / 6M / YTD / custom range; KPIs vs previous period (suppressed when there isn't enough history, instead of showing misleading %); trend area; distribution; top categories with change; monthly comparison; savings-ratio line; weekday pattern; top merchants; payment methods; **table view** for charts |
| **Insights** | 10 deterministic rules + 5-component health score, topic filters, "how insights are generated" disclosure |
| **Settings** | Theme (persisted to the account), currency, income, budgeting style, goals, notification preferences + reminder window, password change, JSON/CSV export, demo reset, account deletion |
| **Global** | Command palette (`Ctrl/⌘ K` or `/`), keyboard shortcuts (`N` new transaction, `G` then `D/T/A/B/G/S/I` to navigate), notification center driven by insights and preferences, light/dark/system themes, toasts, skeletons, empty states |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)**, React 19, TypeScript (strict) | Server components for auth-gated layouts, route handlers for a clean REST API |
| Styling | **Tailwind CSS v4**, design tokens as CSS variables | One token set drives both themes and the charts |
| Components | **shadcn/ui pattern** on **Radix UI** primitives (`components.json` included) | Accessible dialogs, menus, switches, tabs, tooltips — owned in-repo, fully themeable |
| Motion | **Framer Motion** | Page/section entrances, animated progress rings, shared-layout nav indicator; respects `prefers-reduced-motion` |
| Charts | **Recharts** with custom tooltips/legends + accessible table fallbacks | |
| Data | **Prisma 6 + SQLite** | Relational schema, migrations, seeding |
| Auth | Custom **database sessions** + **bcrypt** | Opaque, revocable tokens (hash stored), no beta dependencies (see [Security](#security)) |
| Validation | **Zod** — the same schemas run in the browser and on the server | |
| Client data | **SWR** | Caching + revalidation; every mutation revalidates all views so totals update instantly |
| Tests | **Vitest** (unit), **Playwright** (E2E, desktop + Pixel 7) | |

---

## Architecture

```
Browser (React client components, SWR)
   │  fetch JSON
   ▼
Next.js middleware ── route guard (cookie presence) + CSRF origin check for mutations
   │
   ├── Server components / layouts ── requireUser() → redirect if signed out / not onboarded
   └── Route handlers  /api/*  ── withUser(): resolves the session against the DB,
          │                        Zod-validates input, scopes every query by user.id
          ▼
   src/server/data.ts ── loaders that map DB rows (integer paise) to DTOs (rupees)
          │
          ├── src/lib/finance/*  ── PURE, unit-tested logic:
          │      analytics.ts (summaries, series, categories, weekday patterns)
          │      planning.ts  (budget state & projections, goal progress, subscriptions)
          │      health.ts    (explainable 0–100 score)
          │      insights.ts  (rule-based insights engine)
          └── Prisma Client ─► SQLite
```

Key decisions:

- **Money is stored as integer minor units** (paise) to avoid floating-point drift; conversion happens only at the API boundary.
- **Dates are calendar days** stored at 12:00 UTC and bucketed in UTC, so day/week/month grouping is identical on any server or browser timezone.
- **All metrics are computed from the database on request** — there are no stored totals that could drift out of sync, and nothing on a dashboard is hard-coded.
- **Business logic is framework-free** (`src/lib/finance`), which makes it easy to unit test and reason about.

---

## Folder structure

```
finsight/
├── prisma/
│   ├── schema.prisma            # 8 models, relations, indexes, cascades
│   ├── migrations/              # SQL migrations
│   ├── seed.ts                  # demo account
│   └── cleanup-test-users.ts
├── src/
│   ├── app/
│   │   ├── page.tsx             # landing page
│   │   ├── (auth)/login, signup # split-screen auth layout
│   │   ├── onboarding/
│   │   ├── (app)/               # authenticated shell: dashboard, transactions, analytics,
│   │   │                        # budgets, goals, subscriptions, insights, settings, profile
│   │   └── api/                 # REST route handlers (auth, transactions, budgets, goals,
│   │                            # subscriptions, analytics, insights, dashboard, user)
│   ├── components/
│   │   ├── ui/                  # design-system primitives (button, inputs, dialogs, menus…)
│   │   ├── charts/              # Recharts wrappers with tooltips, legends, table fallbacks
│   │   ├── layout/              # app shell, nav, command palette, notifications, quick actions
│   │   ├── insights/ transactions/ auth/ marketing/
│   │   └── shared.tsx icons.tsx providers.tsx app-context.tsx
│   ├── lib/
│   │   ├── finance/             # pure analytics / planning / health / insights logic
│   │   ├── auth/                # sessions, password hashing, rate limiting
│   │   ├── validators.ts csv.ts money.ts dates.ts constants.ts demo-data.ts api.ts client.ts
│   ├── server/                  # data loaders shared by pages and API routes
│   └── middleware.ts
└── tests/
    ├── unit/                    # Vitest — 54 tests
    └── e2e/                     # Playwright — 15 tests (desktop + mobile)
```

---

## Database design

| Model | Notes |
|---|---|
| `User` | unique email, bcrypt hash, `onboarded`, `isDemo` |
| `Session` | SHA-256 **hash** of the session token, expiry, user agent; cascades on user delete |
| `UserPreference` | 1:1 with user — currency, theme, income, budgeting style, goals (JSON), notification toggles, reminder window |
| `Transaction` | amount (paise, positive), `type` INCOME/EXPENSE, category, date, payment method, optional link to a subscription (`ON DELETE SET NULL`, so history survives deleting a subscription) |
| `Budget` | per user × category × month (`@@unique`), limit, alert threshold |
| `SavingsGoal` | target, optional date, icon/colour, `completedAt` kept in sync with contributions |
| `GoalContribution` | signed amount (withdrawals are negative); cascades with the goal |
| `Subscription` | amount per cycle, MONTHLY/YEARLY, next payment date, ACTIVE/CANCELLED |

Indexes cover the hot paths (`[userId, date]`, `[userId, type, date]`, `[userId, category]`, `[userId, month]`, `[userId, nextPaymentDate]`). Deleting a user cascades to every owned record. Enum-like columns are strings (SQLite has no enums) and are constrained by Zod at the API boundary.

---

## Insights engine & health score

The insights engine (`src/lib/finance/insights.ts`) is **local, deterministic and explainable** — no external AI, no invented numbers. Every insight cites the figures it was derived from and links to where the user can act.

| # | Rule |
|---|---|
| 1 | Category spending up/down ≥15% (and ≥₹500) vs **the same number of days** last month |
| 2 | Budget over limit / past alert threshold / projected to overspend at current pace |
| 3 | Weekend days cost ≥1.3× weekdays |
| 4 | Savings ratio changed by ≥5 points (plus a nudge if expenses exist but no income) |
| 5 | Subscription payments due inside the user's reminder window |
| 6 | ≥3 active subscriptions in one category (with yearly cost) |
| 7 | Unusual transaction: > mean + 2σ of the 90-day category history **and** ≥2.5× median |
| 8 | Savings opportunity: trim the largest discretionary category by 20% |
| 9 | Goals behind schedule / overdue / nearly complete |
| 10 | One non-housing category > ⅓ of spending |

Redundant insights are suppressed (e.g. no "Shopping is up" card when a Shopping budget alert already exists).

**Health score (0–100)** = Savings rate (30) + Budget adherence (25) + Spending trend (15) + Recurring-cost load (15) + Goal progress (15). The Insights page shows every component's points and the reason, so the score is never a black box.

---

## UI/UX design decisions

- **Design system first.** All colours, radii, shadows and chart colours are CSS variables defined once for dark (midnight navy) and light themes; components never use raw colours. Typography pairs *Plus Jakarta Sans* (display) with *Inter* (UI) and tabular numerals for every amount.
- **Validated, colour-blind-safe chart palette.** Income (teal) vs expense (violet) and the 8-slot category palette were checked for CVD separation and contrast in both themes. Categories always have an **icon + label**, so meaning never depends on colour alone; donut charts fold the tail into "Other" instead of inventing extra colours; every chart has a screen-reader table and the main analytics chart has a visible table toggle.
- **Honest numbers.** Month-to-date figures are compared with the *same days* of last month; period comparisons are hidden when the user's history doesn't cover the previous period, rather than showing a misleading "+900%".
- **Progressive disclosure.** Dashboard shows the summary; Analytics and Insights hold the depth; the insights rulebook and health breakdown are expandable.
- **Error prevention & recovery.** Inline validation using the server's own schemas, live password checklist, type-aware category pickers, CSV dry run, confirmation dialogs for destructive actions, **undo** after deleting transactions, typed confirmation for account deletion.
- **Feedback.** Toasts for every mutation, real skeletons while data loads, meaningful empty states with a next action, loading states on buttons.
- **Mobile is designed, not shrunk.** Bottom tab bar with a central add button, slide-over navigation, dialogs become bottom sheets, transactions become a date-grouped list, filter rows scroll horizontally.
- **Keyboard & accessibility.** Skip link, visible focus rings, Radix-managed focus trapping, ARIA labels on icon buttons, radio-group semantics for segmented controls, `aria-live` month labels, command palette with arrow-key navigation, `prefers-reduced-motion` respected.
- **Motion with purpose.** Short (≤350 ms) entrance fades, animated progress rings and a shared-layout nav indicator — no decorative looping animation.

---

## Security

- Passwords hashed with **bcrypt** (cost 11); never logged or returned. Login compares against a dummy hash for unknown emails to avoid user enumeration by timing.
- **Opaque session tokens** (32 random bytes) in `httpOnly`, `SameSite=Lax`, `Secure` (production) cookies; only a SHA-256 hash is stored, so a leaked DB can't hijack sessions. Logout deletes the session server-side; changing the password revokes all other sessions.
- **Server-side authorization everywhere**: every route handler resolves the user from the DB session and scopes queries by `userId`; other users' IDs return 404. Verified by an E2E test.
- **CSRF**: middleware rejects cross-origin state-changing API requests; cookies are `SameSite=Lax`.
- **Validation**: Zod on every input, amount caps, CSV size/row limits; security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Rate limiting on login and sign-up (in-memory; see limitations).

Why not Auth.js? For a credentials-only app, revocable database sessions are simpler to reason about and audit than Auth.js's credentials provider (which is JWT-only), and avoid depending on a beta release.

---

## Testing

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint (next/core-web-vitals + typescript)
npm test              # Vitest unit tests (54)
npx playwright install chromium   # first time only
npm run build && npm run test:e2e # Playwright E2E (15) against the production build
npm run db:cleanup-tests          # optional: remove accounts created by E2E runs
```

**Unit tests** cover money formatting (Indian grouping, lakh/crore), date ranges, analytics aggregation, budget states and projections, goal scheduling, subscription date maths, the health score, every major insight rule, CSV parsing/round-trip and the Zod validators.

**E2E tests** cover: route protection, login errors, sign-up validation, sign-up → onboarding → starter budgets → logout, demo login, transaction CRUD + search + filters + persistence, budget recalculation through *approaching* and *exceeded*, goal contributions to completion, subscription payment recording and cancellation, cross-user data isolation, CSV import dry-run, and responsive layouts on a Pixel 7 profile (no horizontal overflow on any page, tab bar and slide-over navigation).

### Continuous integration & auto-sync

- **CI** (`.github/workflows/ci.yml`) runs migrations, typecheck, lint, unit tests and a production build on every push to `main`.
- **Auto-sync:** `scripts/auto-commit.sh` stages, commits and pushes any changes (respecting `.gitignore`, so `.env`, the database and build output are never committed). It runs automatically after each development session, or manually with `bash scripts/auto-commit.sh`.

---

## Screenshots for GitHub

1. `npm run setup && npm run dev`, then sign in with the demo account.
2. Use a 1440×900 browser window (DevTools → device toolbar → *Responsive*, 1440×900) for desktop shots and *Pixel 7* for mobile shots.
3. Capture full-page screenshots (DevTools → `Ctrl+Shift+P` → *Capture full size screenshot*) of: Landing, Dashboard, Transactions, Analytics (6M), Budgets, Goals, Subscriptions, Insights — in **dark** and **light** themes (toggle at the bottom of the sidebar).
4. Save them as `docs/screenshots/<page>-<theme>.png` and reference them here, e.g.

```md
![Dashboard — dark](docs/screenshots/dashboard-dark.png)
```

Tip: before capturing, run *Settings → Reset demo* so the data is dated around today.

---

## Known limitations

- **No bank connections** — data is entered manually or imported via CSV (a deliberate privacy-first choice for a portfolio project).
- **Currency is display-only** — switching currency changes formatting, not values; there is no FX conversion.
- **Notifications are in-app** (bell icon); there is no email/push delivery service.
- **Rate limiting is in-memory**, so it resets on restart and isn't shared across multiple server instances (swap for Redis/Upstash in production).
- **SQLite** is ideal for a single-instance demo; for multi-instance hosting switch the Prisma datasource to PostgreSQL.
- Dates are treated as calendar days in UTC; a transaction entered just after midnight IST is recorded on the user's chosen date, but "today" boundaries follow UTC.
- No password-reset email flow (requires an email provider).
- **OneDrive users:** if a build fails with `EINVAL: readlink … .next`, delete the `.next` folder and rebuild (OneDrive converts build files into cloud placeholders). Keeping the project outside a synced folder avoids this.
