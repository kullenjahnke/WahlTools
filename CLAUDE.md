# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**WahlTools** is an internal price-tracking and competitive-analysis platform for **Wahlburgers at Home** retail products. It lets a small set of authorized users:

- Maintain a product catalog (Wahlburgers products + competitor products) with images, categories, brands, aliases, and retailer-specific URLs.
- Record and track prices across **9 retail chains**, including promotions, sold-out status, and original/discounted pricing.
- View price history, week-over-week change analytics, and Wahlburgers-vs-competitor comparisons.
- Export price data to CSV/Excel.

It is deployed on **Vercel**, backed by **Supabase** (Postgres + Auth + Storage). Production URL: `https://wahlburgers-price-tracker.vercel.app`. Sending domain (for email, Phase 3): `wahlburgersathome.com`.

## Development Commands

```bash
pnpm dev                  # Start development server on http://localhost:3000
pnpm build                # Build for production
pnpm start                # Start production server
pnpm lint                 # Run Next.js linting

# Package manager: pnpm (see pnpm-lock.yaml)
pnpm install              # Install dependencies
pnpm add <package>        # Add new dependency
```

## Tech Stack

- **Framework**: Next.js 15.5.12 (App Router) + React 19
- **Language**: TypeScript 5 (strict mode)
- **Database / Auth / Storage**: Supabase (Postgres) via `@supabase/supabase-js` + `@supabase/ssr`
- **UI**: shadcn/ui (new-york style) on Radix primitives
- **Styling**: Tailwind CSS 3.4 with `darkMode: ["class"]` + CSS-variable design tokens (dark theme tokens already defined in `globals.css`, but no toggle is wired yet)
- **Forms**: react-hook-form + Zod (`@hookform/resolvers`)
- **Charts**: Recharts
- **Data utilities**: papaparse + xlsx (CSV/Excel import/export), date-fns
- **Icons**: lucide-react + custom retailer SVGs

## Architecture

### Authentication Flow
Middleware (`src/middleware.ts`) refreshes the Supabase session on every request, redirects unauthenticated users to `/login`, and redirects logged-in users away from `/login` and `/register`. Registration is **whitelist-gated** via `src/lib/auth/whitelist.ts` (authorized emails from the `AUTHORIZED_EMAILS` env var, with a hard-coded fallback list). The dashboard layout sets `export const dynamic = "force-dynamic"`.

### Supabase Clients (`src/lib/supabase/`)
- `client.ts` — browser client (`createClientClient()`) for client components.
- `server.ts` — server client (`createSupabaseServerClient()`) with cookie handling for Server Components, server actions, and API routes.

### Server Actions (`src/app/actions/`)
- `products.ts` — `createProduct`, `updateProduct`, `deleteProduct`.
- `prices.ts` — `fetchLatestPrices`, `fetchProductPriceHistory`, `getPriceChangeStats` (week-over-week buckets, EST-based), `recordPriceCheck` (atomic via the `record_price_check` RPC).
- `images.ts` — `uploadProductImage`, `deleteProductImage`, `setMainImage` (Supabase Storage bucket `product-images`).

### API Routes (`src/app/api/` + `src/app/auth/`)
- `auth/callback/route.ts` — Supabase OAuth callback.
- `api/auth/check-whitelist/route.ts` — registration email whitelist check.
- `api/prices/bulk-update/route.ts` — batch price updates with change logging.
- `api/prices/history/route.ts` — filtered price-history query.

### Database Schema (`src/types/database.ts`, migrations in `migrations/`)
Core tables: `products`, `product_categories`, `brands`, `prices`, `price_change_logs`, `product_images`, `product_urls`, `price_check_logs`. Legacy competitor tables (`competitors`, `competitor_products`, `competitor_product_urls`, `competitor_prices`) remain from before the unified-products migration (see `MIGRATION_PLAN.md`). 14 ordered SQL migrations + an atomic `record_price_check(p_retailer, p_prices, p_notes)` RPC.

### Retailer Configuration
- `src/lib/config/retailers.ts` — the 9 retailers (`Jewel-Osco`, `Stop & Shop`, `Acme`, `Shaws`, `Giant Eagle`, `Giant Food Stores`, `Big Y`, `Publix`, `Safeway`) + `RETAILER_COLORS`.
- `src/lib/config/retailer-stores.ts` — store IDs/zips for retailers needing manual store selection.
- `src/lib/config/colors.ts` — brand + chart color palette.

### Component Organization (`src/components/`)
- `ui/` — shadcn primitives (~23 files).
- `layout/` — `main-nav`, `mobile-nav`.
- `products/`, `prices/`, `analytics/`, `dashboard/`, `comparison/`, `competitors/`, `auth/`, `icons/` — feature components by domain.
- State is **vanilla React hooks only** (no Redux/Zustand/React Query). One custom hook: `src/hooks/use-toast.ts`. The only React contexts are shadcn's internal form contexts.

## Feature / Page Inventory

Navbar: **Dashboard · Products · Prices · Analytics · Comparison · Settings**

| Route | Purpose |
|-------|---------|
| `/login`, `/register` | Auth (whitelist-gated registration) |
| `/dashboard` | Stats cards, price summary, recent activity, price-check status, competitor summary |
| `/dashboard/prices` | Price table + trends tabs, export modal |
| `/dashboard/prices/check` | Record prices for a retailer |
| `/dashboard/prices/bulk-update` | **Bulk Price Entry** (all retailers for one product) |
| `/dashboard/prices/sequential` | Sequential entry with auto-advance |
| `/dashboard/prices/history` | Historical price view + analytics |
| `/dashboard/prices/reminders` | Price-check reminder setup |
| `/dashboard/products` | Product list (search/filter/sort) |
| `/dashboard/products/new`, `/[id]`, `/[id]/view` | Create / edit / view product |
| `/dashboard/products/urls` | Manage retailer URLs |
| `/dashboard/products/import` | CSV bulk import |
| `/dashboard/comparison`, `/comparison/history` | Wahlburgers vs competitor comparison |
| `/dashboard/competitors/*` | Mostly redirects to `/products` (unified); a few live pages: `/check`, `/urls`, product detail |
| `/dashboard/analytics` | `ProductAnalytics` charts |
| `/dashboard/backup` | JSON DB export (not in navbar) |
| `/dashboard/settings` | Placeholder ("coming soon") |

## Current State (June 2026)

- Core catalog, pricing, history, comparison, analytics, and import/export flows are functional.
- Dark-mode **tokens** exist in `globals.css` but there is no theme toggle or persistence.
- No email or cron infrastructure yet.
- README is still Create-Next-App boilerplate.

## Known Issues / Tech Debt

- **Orphaned analytics components** (imported nowhere): `analytics/category-analysis.tsx`, `analytics/price-change-patterns.tsx`, `analytics/price-trends-chart.tsx`, `analytics/retailer-comparison.tsx`.
- **Duplicate/redundant components**: two `price-history-chart.tsx` (in `prices/` and `products/`); multiple product-form variants (`product-form`, `unified-product-form`, `enhanced-unified-product-form`).
- **Empty stubs**: `src/lib/prices/{types,utils,validation}.ts`.
- **Stale docs**: `README.md` (boilerplate); `AUDIT_REPORT.md` contains some inaccurate claims (e.g., it states the build ignores TS/ESLint errors — `next.config.ts` does **not** do this).
- **Legacy competitor tables** persist post-migration; competitor routes are mostly redirects.
- **No page titles** beyond the root metadata + one `/products/import` title.
- Per `AUDIT_REPORT.md`: RLS policy, atomicity, and error-handling concerns worth revisiting.

## Roadmap (this engagement)

This codebase is being worked through a multi-phase cleanup + feature engagement on the `wahltools-cleanup-and-features` branch:

- **Phase 2 — Cleanup**: remove unused/dead code after explicit per-item approval. Confirmed candidates: the dashboard **Competitor Analysis** section (`CompetitorPriceSummary`, last section of `/dashboard`), the **Backup** page, the 4 orphaned analytics components, stale `.md` files; plus a full sweep for other dead code (empty stubs, duplicate charts, redundant forms, redirect-only competitor routes, Bulk Price Entry).
- **Phase 3 — Feature review + weekly email reminder**: fix any broken features; build a **Resend**-based weekly price-reminder email triggered by **Vercel Cron** (Wednesday 9:00 AM America/Detroit, with DST handled in-handler since Vercel Cron is UTC-only and DST-unaware). Recipients: `info@kullenjahnke.com`, `rjahnke@arkkfood.com`. From: `reminders@wahlburgersathome.com`. Includes a manual test-trigger.
- **Phase 4 — Favicon + page titles**: generate a full favicon set from a provided logo and add `WahlTools | (Page)` titles to every route via Next.js metadata.
- **Phase 5 — UI overhaul (plan only)**: research + written plan (Mobbin references) for a professional redesign incl. a dark-mode theme; no implementation.

### Environment Variables
Required in `.env.local` (and Vercel project settings):
```
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
AUTHORIZED_EMAILS=<comma-separated whitelist>      # registration whitelist
# Phase 3 (planned):
RESEND_API_KEY=<resend-api-key>
CRON_SECRET=<vercel-cron-auth-secret>              # to protect the cron endpoint
```

### Important Notes
- Image uploads use Supabase Storage; the bucket domain is allow-listed in `next.config.ts`.
- Server actions have a 5MB body-size limit (`next.config.ts`).
- All timestamps are ISO strings in Supabase; week-over-week stats compute in EST.
- `tsconfig.json` path alias: `@/*` → `./src/*`. `node_modules`, `backups`, `scripts` are excluded from the TS build.
- Utility scripts in `scripts/` (DB backup/export, migrations) run manually via ts-node.
