# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**WahlTools** is an internal price-tracking and competitive-analysis platform for **Wahlburgers at Home** retail products. It lets a small set of authorized users:

- Maintain a product catalog (Wahlburgers + competitor brands) with images, categories, brands, aliases, and retailer-specific URLs.
- Record and track prices across **9 retail chains**, including promotions, sold-out status, "N/A" (no longer carried) status, and original/discounted pricing.
- View price history, week-over-week analytics, and head-to-head product comparisons.
- Receive automated weekly price-check reminders (+ a follow-up for stale retailers and an "unavailable products" digest) by email.
- Export price data to CSV/Excel.

It is deployed on **Vercel**, backed by **Supabase** (Postgres + Auth + Storage). Production URL: `https://wahlburgers-price-tracker.vercel.app`. Reminder email sending uses **Resend** (from `noreply@reminders.arkkfood.com`).

## Development Commands

```bash
pnpm dev                  # Start development server on http://localhost:3000
pnpm build                # Build for production
pnpm start                # Start production server
pnpm lint                 # Run Next.js linting

# Package manager: pnpm (see pnpm-lock.yaml)
pnpm install              # Install dependencies
```

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript 5 (strict mode)
- **Database / Auth / Storage**: Supabase (Postgres) via `@supabase/supabase-js` + `@supabase/ssr`
- **UI**: shadcn/ui (new-york style) on Radix primitives
- **Styling**: Tailwind CSS 3.4, `darkMode: ["class"]` + CSS-variable design tokens. **Dark mode is fully wired** via `next-themes` (provider + toggle) — see Theming below.
- **Forms**: react-hook-form + Zod
- **Charts**: Recharts
- **Email**: Resend (weekly reminder + follow-up + N/A digest)
- **Data utilities**: papaparse + xlsx (CSV/Excel), date-fns
- **Icons**: lucide-react + custom retailer SVGs

## Architecture

### Authentication Flow
Middleware (`src/middleware.ts`) refreshes the Supabase session on every request, redirects unauthenticated users to `/login`, and redirects logged-in users away from `/login` and `/register`. Registration is **whitelist-gated** via `src/lib/auth/whitelist.ts` (`AUTHORIZED_EMAILS` env var + fallback list). The dashboard layout is `force-dynamic`.

### App Shell & Theming
- **Layout** (`src/app/(dashboard)/dashboard/layout.tsx`): full-height flex shell — `AppSidebar` (collapsible, `src/components/layout/app-sidebar.tsx`) + `AppTopbar` (`app-topbar.tsx`, holds email, theme toggle, sign-out) + scrollable `<main>`. `MobileNav` handles small screens.
- **Theming**: `src/components/theme/theme-provider.tsx` (next-themes) wraps the app; `theme-toggle.tsx` switches light/dark. Tokens live in `src/app/globals.css` (`:root` + `.dark`), font is **Inter Tight**, and `--brand` is the semantic green (`#44B549`). `--brand-muted` is the low-opacity brand tint used by brand chips/badges. **Design every surface for both light and dark.**

### Shared layout/UI primitives (build once, reuse everywhere)
- `src/components/layout/page-container.tsx` — `PageContainer`: the single source of truth for page padding (full-width, `p-4 md:p-6`). Wrap every page in it.
- `src/components/layout/page-header.tsx` — `PageHeader`: standardized title (`text-2xl font-semibold tracking-tight`, **no subtitles**), optional breadcrumbs, and a right-aligned `actions` slot. Used on every page.
- `src/components/layout/breadcrumbs.tsx` — `Breadcrumbs`: used on **subpages only** (e.g. Prices › Reminders).
- `src/components/ui/chip.tsx` — `Chip`: color-coded pill. `tone="auto"` derives a stable hue from `colorKey`; `tone="brand"` for Wahlburgers; or pass a raw class string. Sizes `sm|md|lg`. Used for categories, brands, freshness, status, and comparison best/worst pills. Light mode uses solid `-100` tints; dark uses translucent tints.
- `src/components/ui/row-actions.tsx` — `RowActions`: kebab (⋯) overflow menu (Edit/Delete, etc.).
- `src/components/ui/icon-button.tsx` — `IconButton`: tooltip-labelled icon button that replaces text links; renders a Next `Link` when given `href`.
- `src/components/icons/retailers/index.tsx` — `RETAILER_ICONS` map (retailer name → brand SVG), shared by Prices cards and the Dashboard status card.

### Shared domain utilities
- `src/lib/freshness.ts` — price freshness helpers (`daysSince`, `classifyFreshness`, thresholds). Note: in the Prices table, freshness is computed **per retailer-cell** as Active / Stale (≥`staleDays`) / Unavailable (explicit N/A).
- `src/lib/competitiveness.ts` — `computeRetailerCompetitiveness` / `median`: a retailer's prices vs. the all-retailer median for matched products (drives the Prices retailer cards) and category-median comparisons (Comparison page).
- `src/lib/config/brands.ts` — `BRANDS` (the 4 active brands: **Wahlburgers, Catelli, Grillo's, Schweid & Sons**) + `productMatchesBrand` (punctuation-tolerant). Drives the Products + Prices brand filters.

### Server Actions (`src/app/actions/`)
- `products.ts` — `createProduct`, `updateProduct`, `deleteProduct`.
- `prices.ts` — `getPriceChangeStats` (week-over-week buckets, EST-based), `recordPriceCheck` (atomic via the `record_price_check` RPC), etc.
- `images.ts` — `uploadProductImage`, `deleteProductImage`, `setMainImage` (Storage bucket `product-images`).
- `reminders.ts` — `sendTestPriceReminder`, `getReminderSettings`, `saveReminderSettings`.

### Email + Cron (reminder system) — `src/lib/email/`
- `resend.ts` (lazy client), `config.ts` (from-address, accent, prices URL), `schedule.ts` (America/Detroit weekday/hour helpers), `shell.ts` (branded HTML shell + list), `price-reminder-template.ts`, `send-price-reminder.ts`, `send-followup.ts`, `send-na-digest.ts`, `reminder-data.ts` (stale-retailer + recent-N/A queries), `settings.ts` (`ReminderSettings` type, defaults, parsers).
- **Settings are DB-backed** in the `reminder_settings` singleton table (migration `14_reminder_settings.sql`), edited from the Reminders page.
- **Cron**: `src/app/api/cron/price-reminder/route.ts` runs **daily** (`vercel.json`, `0 13 * * *` ≈ 9 AM US Eastern — daily is the max on the current Vercel plan). It authenticates with `CRON_SECRET`, reads `reminder_settings` via the **service-role** admin client (`src/lib/supabase/admin.ts`), and on the matching America/Detroit weekday fires: the **weekly reminder**, the **per-retailer follow-up** (retailers not updated in > `stale_threshold_days`, sent `followup_days_after` days later), and the **weekly N/A digest** (products marked N/A in the last 7 days → `na_recipients`).
- ⚠️ The cron requires **`SUPABASE_SERVICE_ROLE_KEY`** in the environment; without it the cron errors and no reminders send. *(If the project moves to a Vercel plan allowing sub-daily crons, switch `vercel.json` to hourly and re-add the hour gate in the route to honor the exact configured time.)*

### Other API Routes
- `auth/callback/route.ts` — Supabase OAuth callback.
- `api/auth/check-whitelist/route.ts` — registration email whitelist check.

### Supabase Clients (`src/lib/supabase/`)
- `client.ts` — browser client (`createClientClient()`).
- `server.ts` — server client (`createSupabaseServerClient()`, cookie-aware).
- `admin.ts` — **service-role** client (`createSupabaseAdminClient()`) for trusted server contexts (cron, settings read/write). Never expose to the browser.

### Database Schema (`src/types/database.ts`, migrations in `migrations/`)
Core tables: `products`, `product_categories`, `brands`, `prices`, `price_change_logs`, `product_images`, `product_urls`, `price_check_logs`, `reminder_settings`. Legacy competitor tables (`competitors`, `competitor_products`, `competitor_product_urls`, `competitor_prices`) remain from before the unified-products migration. Ordered SQL migrations (`01`–`14`) + the atomic `record_price_check(p_retailer, p_prices, p_notes)` RPC.

**Price status conventions** (used across Prices/Comparison/Analytics):
- A **sold-out** price = `status === 'out_of_stock'` or `is_sold_out === true`.
- An **N/A** price (product no longer carried at that retailer) = `price <= 0` **and not** sold out. Rendered as an "N/A" chip, never as `$0.00`.

### Retailer Configuration
- `src/lib/config/retailers.ts` — the 9 retailers + `RETAILER_COLORS`.
- `src/lib/config/retailer-stores.ts` — store IDs/zips for retailers needing manual store selection.
- `src/lib/config/colors.ts` — chart color palette.

## Feature / Page Inventory

Sidebar nav: **Dashboard · Products · Prices · Comparison · Analytics · Settings**. Every page uses `PageContainer` + `PageHeader`; subpages add breadcrumbs.

| Route | Purpose |
|-------|---------|
| `/login`, `/register` | Auth (whitelist-gated registration) |
| `/dashboard` | 4 KPI tiles (Products, Retailers, Latest Update, Weekly Freshness) + **Recent Updates** (fade + "See all" expander) + **Price Check Status** (per-retailer icons + status chips) |
| `/dashboard/prices` | Retailer cards (competitiveness vs market) + price table (brand/category chips, per-cell freshness w/ "Highlight freshness" toggle, green/red change indicators, Export). One-line icon action bar |
| `/dashboard/prices/check` | Record prices for a retailer |
| `/dashboard/prices/sequential` | Sequential entry with auto-advance |
| `/dashboard/prices/history` | Historical price view + analytics |
| `/dashboard/prices/reminders` | Weekly reminder (day/time/email) + follow-up + N/A digest settings |
| `/dashboard/products` | Product list (grid/table; color-coded brand/category chips, kebab actions, brand/category filters) |
| `/dashboard/products/new`, `/[id]`, `/[id]/view` | Create / edit / view product |
| `/dashboard/products/urls` | Manage retailer URLs |
| `/dashboard/products/import` | CSV bulk import |
| `/dashboard/comparison` | **Head-to-head** comparison: left product selector + up to 4 columns of metric pills (green=best/red=worst) + price-by-retailer section |
| `/dashboard/comparison/history` | Legacy Wahlburgers-vs-competitor history chart (no longer linked from Comparison; uses legacy competitor tables) |
| `/dashboard/competitors/*` | Mostly redirects to `/products` (unified); a few legacy live pages |
| `/dashboard/analytics` | Multi-series price chart with 3 compare modes (by retailer / product / category), data-aware legend toggles, metrics table |
| `/dashboard/settings` | Placeholder ("coming soon") |

## Current State (June 2026)

- Catalog, pricing, history, comparison, analytics, import/export, and the reminder system are functional.
- A full **UI/UX overhaul** has been applied: consistent page header/padding/breadcrumbs, color-coded chips, kebab menus, icon buttons, reworked Dashboard, head-to-head Comparison, multi-mode Analytics, and a redesigned Prices table with per-cell freshness.
- **Dark mode is live** (toggle + persistence via next-themes).
- The **Resend + Vercel-cron reminder system** is built (weekly + follow-up + N/A digest), driven by the editable `reminder_settings` table.

## Known Issues / Tech Debt

- **Legacy competitor tables/routes** persist post-migration; `/dashboard/competitors/*` are mostly redirects and `/dashboard/comparison/history` is legacy/orphaned (depends on competitor tables).
- Duplicate/redundant components may remain (e.g. multiple product-form variants; a now-unused `prices/price-history-chart.tsx` after the Price Trends tab was removed).
- `AUDIT_REPORT.md` may contain stale claims; treat the codebase as source of truth.
- Per prior audits: RLS policy, atomicity, and error-handling concerns are worth revisiting.

## Environment Variables

Required in `.env.local` (and Vercel project settings):
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>      # required by the reminder cron
AUTHORIZED_EMAILS=<comma-separated whitelist>     # registration whitelist
RESEND_API_KEY=<resend-api-key>                   # reminder emails
CRON_SECRET=<vercel-cron-auth-secret>             # protects /api/cron/*
ZERNIO_API_KEY=<zernio-publishing-api-key>     # Phase 2 live publishing
ZERNIO_WEBHOOK_SECRET=<zernio-webhook-hmac-secret>
ANTHROPIC_API_KEY=<anthropic-api-key>             # Phase 3 AI caption generation
```

## Important Notes
- Image uploads use Supabase Storage; the bucket domain is allow-listed in `next.config.ts`.
- Server actions have a 5MB body-size limit (`next.config.ts`).
- All timestamps are ISO strings in Supabase; week-over-week stats compute in EST; reminder scheduling uses America/Detroit.
- `tsconfig.json` path alias: `@/*` → `./src/*`. `node_modules`, `backups`, `scripts` are excluded from the TS build.
- Building locally without Supabase env vars fails only at the auth-page prerender step; set placeholder `NEXT_PUBLIC_SUPABASE_*` in `.env.local` to build offline.
