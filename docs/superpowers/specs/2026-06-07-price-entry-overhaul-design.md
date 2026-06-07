# Price-Entry Overhaul — Design Spec

**Date:** 2026-06-07
**Status:** Approved for planning
**Branch / PR:** `feature/price-entry-overhaul` → single **draft PR**; one commit per phase; `pnpm lint` + production build before every commit; **pause for Vercel-preview review after each phase** before starting the next. Do not merge to `main` without explicit OK.

## Goal

Make the weekly **manual price-recording** flow as fast and pleasant as possible (until automated scraping exists), plus targeted related improvements. Aesthetic: futuristic-minimal, consistent with the existing design system — shared `PageContainer` / `PageHeader` / `Chip` / `IconButton` / `RowActions`, Inter Tight, `--brand` green, lucide-react icons, full light + dark support.

## Non-goals

- No scraping/automation.
- No scheduling changes (Vercel plan is daily-cron-limited).
- No changes to the legacy competitor tables/routes.

---

## Phase 0 — Cross-cutting foundations (no/low UI)

Shared plumbing every workstream depends on. Small, unit-testable, committed first.

### 0.1 Canonical retailer ordering
- New helper `orderRetailers(available: string[]): string[]` (in `src/lib/config/retailers.ts` or a small util) that sorts any retailer set by `RETAILERS` config index.
- Consumers: check-page tabs **and** auto-advance (they currently disagree), the sequential retailer picker, and export sheet order.
- Rule: tabs/picker show **only retailers with ≥1 product URL**, in config order.

### 0.2 Unified atomic save
- New server action `recordRetailerPrices(retailer, items[])` where each item carries the **full shape**: `product_id`, `price`, `status` (`active` | `out_of_stock` | `not_carried`), `original_price`, `is_promotion`, `discount_percentage`, `is_sold_out`.
- Backed by an **extended `record_price_check` RPC** — **migration `15_extend_record_price_check.sql`** — that marks prior `active` rows historical, inserts the new rows with full fields, and logs the check, all in one transaction. (Must be run manually in the Supabase SQL editor, per existing migration convention.)
- **Both** the Record Prices page and the Sequential flow call this one action, replacing today's non-atomic direct `.update()` + `.insert()` writes.
- **Fixes a latent bug:** the check form currently writes `on_sale` (no such column) instead of `is_promotion`; sale flags were being dropped. Unify on `is_promotion` + `discount_percentage` + `original_price`.

### 0.3 Outlier detection
- Pure helper `detectPriceOutlier({ productId, retailer, newPrice, history }): { isOutlier, pct, reference } | null`.
- Rule: flag when `newPrice` deviates **> ±40%** from that product's **most recent recorded price at that retailer**; if there is no prior price at that retailer, fall back to the **cross-retailer median** for that product with a **> ±50%** tolerance. Thresholds defined as named constants so they're easy to tune.
- Non-blocking: the UI surfaces a warning but never prevents saving.

### 0.4 Retailer "done this cycle"
- Query helper `getRetailerCheckStatus(): Record<retailer, { doneAt: string | null }>` returning retailers with a completed `price_check_logs` row in the **rolling last 7 days**.
- Surfaced as a ✓ done-state on the check-page tabs and the sequential retailer picker.

**Acceptance:** helpers unit-tested; both entry forms compile against the new action; migration 15 documented in `migrations/`.

---

## Phase 1 — Record Prices page (Workstream 1)

Files: `src/app/(dashboard)/dashboard/prices/check/page.tsx`, `src/components/prices/price-check-form.tsx`, `src/app/actions/prices.ts`.

**Mobbin refs:** inline-edit grids — [Causal](https://mobbin.com/screens/066c6273-5faa-45d1-8fb7-64f2b24012c1), [Rows](https://mobbin.com/screens/18cd033a-59ef-4cd8-93ee-d335d754f9a0), [OpenAI Platform](https://mobbin.com/screens/4abaa3f1-e023-44bc-9b4c-63214e7e7f0a).

- **Remove the "Notes" section entirely** — the `notes` state, the textarea, and the per-check log note input. (Log still stores its default auto-summary note.)
- **Retailer tabs** use `orderRetailers` (config order, only retailers with URLs). Each tab shows a **done-state** (brand-green + ✓) when checked in the last 7 days; the active tab is solid dark. A `lucide` check icon, not a glyph.
- **Auto-advance** follows the **visible tab order** (so tabs and advance agree). Label trimmed to just **"Auto-advance"**.
- **"Open all URLs" fix:** open every URL **synchronously inside the single click handler** (no `setTimeout`, which was being pop-up-blocked after the first). If the browser still blocks, drop down a **fallback panel** listing each link to click manually. Per category/retailer.
- **Outlier flag:** when `detectPriceOutlier` trips, show a **compact chip directly under the price input** — lucide `TrendingDown` + `82% was $8.49` — plus a thin amber left-edge on the row. Non-blocking.
- **Carry-over:** on **empty** price fields only, a subtle dashed `↺ Same as last week $4.29` chip (lucide `RotateCcw`); one tap fills the field. Hidden otherwise.
- **Quick actions** as compact **inline chips** (Sale / Out / N/A) replacing the three switch+label clusters. Sale reveals the original-price input.
- **Meta row:** progress bar + a brand-green **`Entered 3/4`** pill (no separate "this week" pill; no `·` separators).
- **No divider lines** under category titles, between sections, or above the save button.
- Sticky **Complete Price Check** footer with a keyboard hint; `↵` in a green **keycap**; Enter jumps field-to-field.
- Saving routes through `recordRetailerPrices`.

**Acceptance:** tabs ↔ auto-advance order identical; done-state reflects last-7-day logs; open-all opens every link (or shows fallback); outlier + carry-over render per rules; no notes UI; save is atomic; light + dark verified.

---

## Phase 2 — Sequential flow (Workstream 2)

Files: `src/app/(dashboard)/dashboard/prices/sequential/page.tsx`, `src/components/prices/sequential-price-entry.tsx`.

**Mobbin refs:** [Duolingo](https://mobbin.com/screens/ea570c5a-5636-45e6-9adf-88bc7e409afd) (top progress + footer), [Hers](https://mobbin.com/screens/89cdb1ad-4955-4c94-94cc-7c5e6df1a3b9) (focused action cards), [Reddit](https://mobbin.com/screens/5235c7c3-4277-469a-b9c9-97adc6b778f5) (one-at-a-time review queue).

- **Retailer-first:** step 1 is a retailer picker (chips in config order, with the same ✓ done-state). Then **one card per product** for that retailer only (no more product×9).
- **Card-stack aesthetic:** active card on top, next two cards peeking behind; advancing animates the top card away. Desktop, **keyboard-first** (not touch swipes).
- **Top progress bar** restyled: exit `✕`, retailer pill, brand-green bar, `7 / 24` count pill.
- **Per card:** product **image thumbnail** (main image from `product_images`, fallback to a category glyph), product name, **brand chip** + **category Chip** (color-coded). 
- **Open beside:** opens the retailer's product page in a **popup window positioned beside the app**; falls back to a normal new tab if the popup is blocked.
- **Last week** chip (compact, green): click or press `L` to fill the price with last week's value. (Same carry-over concept as Phase 1; only "Last week" — no market-median stat.)
- **Big price input**, then **Sale / Sold Out / N/A** quick actions with **title + hotkey on one line** (`◷ Sale  S`).
- **No skip.** Footer: `← Back` (secondary) + **Save & Next** (primary, `↵`).
- **Hotkeys:** `↵` save & next, `L` last week, `S` sale, `O` sold out, `N` n/a, `V` view beside. (Letter keys don't pollute the numeric field.)
- Saving routes through `recordRetailerPrices`; outlier logic available as context.

**Acceptance:** retailer picker → product cards for that retailer; hotkeys work; open-beside positions a popup (fallback tab); image + chips render; save atomic; light + dark verified.

---

## Phase 3 — Export (Workstream 3)

Files: `src/components/prices/export-modal.tsx` + export/data logic. Add **`exceljs`** dependency; **keep CSV** (papaparse). Generation stays **client-side** (like today).

**Mobbin refs:** [Shopify](https://mobbin.com/screens/280babd4-1ad6-4069-827c-0869dedde44c) (Excel vs CSV), [Stripe](https://mobbin.com/screens/19dc4709-7b3a-4acc-a07c-ddd2c16fe0e8), [Remote](https://mobbin.com/screens/e45005e0-af2f-446f-bd6e-7b8928c85884), [HubSpot](https://mobbin.com/screens/88fa0f24-5c98-442c-aae8-6a4743ee3bc6).

### Modal redesign
- **Format toggle:** Excel (.xlsx) / CSV. Excel selected → matrix output; CSV → existing flat log.
- **Date range:** preset chips (Last 4 weeks / This quarter / All time / Custom) above the From/To fields.
- **Filters as chips:** **Retailers** (brand dots, = sheets), **Brands** (square swatches in the brand palette), **Categories**. **Columns** chips shown **only in CSV mode**.
- **All/None → contextual `↺ Reset`** that appears in a section header only after that section is changed.
- Footer scope summary + Export button (label switches Excel/CSV).

### Excel format (matches the reference `Retailer_Price_Charts_First_Run.xlsx`, with agreed tweaks)
- **One worksheet per selected retailer**, named exactly (config order).
- **Matrix layout:** `A1 = "week"`, row 1 columns = **product names** (filtered by selected Brands + Categories); each subsequent row = a **week range** label `YYYY-MM-DD/YYYY-MM-DD` (Mon–Sun bucket), cells = that week's price.
- **Tweaks vs reference:** **blank** (not `0`) for missing weeks; **freeze** row 1 + column A; **`$` currency format** on price cells; **bold + auto-width** headers. Week rows **oldest-first** (as reference).
- **Brand-colored product headers** (header cell fill):
  - Wahlburgers `#44B549`
  - Catelli `#2563EB`
  - Grillo's `#F59E0B`
  - Schweid & Sons `#E11D48`
- **No charts** (ExcelJS has no native charts; explicitly deferred).

### CSV
- Unchanged flat price log; honors date/retailer/brand/category + the Columns picker.

**Acceptance:** Excel opens in Excel with per-retailer sheets, brand-colored headers, blank missing cells, frozen panes, `$` format; CSV still works; modal filters (incl. Brands) + contextual Reset behave; light + dark verified.

---

## Phase 4 — Investigations (Workstream 4)

### 4a — Price History page (product-focused)
Files: `src/app/(dashboard)/dashboard/prices/history/page.tsx`, `src/components/prices/product-price-history.tsx` (salvage), retire `price-history-view.tsx`. Remove `PriceAnalytics` from this page (overlaps the Analytics page).

**Mobbin refs:** [Klarna](https://mobbin.com/screens/a631f8f4-aa66-40e0-8e99-f813a01084e7), [PayPal](https://mobbin.com/screens/d2d808ce-150b-403e-b278-276c04be361b), [Kraken](https://mobbin.com/screens/6e7bc475-38a0-40ce-a51a-e49ca5630a94).

- **Fix the broken chart** (hardcoded `Meijer`/`Walmart`/`Jewel-Osco`) → real `RETAILERS` + `RETAILER_COLORS` with dark-mode chart theming (`useChartTheme`).
- **Searchable product picker** (image + brand/category chips). Everything below is that product's full history.
- **Multi-retailer line chart**, **range chips** (4W / 3M / 1Y / All), **summary stats** (current avg / lowest / highest / 12-wk change), **legend toggles** per retailer.
- **Change log scoped to the selected product** (replaces the global table).

### 4b — Topbar user menu
File: `src/components/layout/app-topbar.tsx`, `src/components/auth/sign-out-button.tsx`.
- Consolidate **email + theme toggle + Settings link + Sign out** into one **user-menu dropdown** (avatar/email trigger). Sign-out gets a **confirm**. Declutters the topbar.

### 4c — Settings page
File: `src/app/(dashboard)/dashboard/settings/page.tsx`. Build with react-hook-form + Zod + Supabase Auth + toasts:
- **Change password** (new + confirm, `updateUser`).
- **Change email** (`updateUser` → confirmation email).
- **Theme preference** (Light / Dark / System).
- **Authorized status** (read-only line).

**Acceptance:** History shows a real per-product multi-retailer chart with working ranges/stats/legend + product-scoped change log; topbar user menu with Settings + confirmed sign-out; Settings page performs password/email changes and theme preference; light + dark verified.

---

## Design-system notes
- Every page wrapped in `PageContainer` + `PageHeader`; subpages keep breadcrumbs.
- Use the shared `Chip` (auto-hue for categories, brand tone for Wahlburgers), `IconButton`, `RowActions`.
- All new glyphs are **lucide-react** (ExternalLink, Tag, PackageX/AlertCircle, XCircle, RotateCcw, TrendingDown, etc.).
- Design every surface for **both light and dark**.

## Risks / notes
- **Migration 15 must be run manually** in Supabase (same as existing migrations) before atomic saves work in production.
- **Pop-up blocking:** open-all (P1) and open-beside (P2) need user-gesture-synchronous opens + a graceful fallback.
- **ExcelJS bundle size** in the client — load it dynamically (code-split) so it only loads when exporting.
- Weekly bucket logic should reuse the existing EST/Mon-start week helpers where possible.

## Phase order & review gates
1. Phase 0 — foundations (pushed; non-visual)
2. Phase 1 — Record Prices  ← first visible preview
3. Phase 2 — Sequential
4. Phase 3 — Export (request reference file already provided)
5. Phase 4 — Investigations

After each phase: `pnpm lint` + production build → commit → push → **stop for Vercel-preview review** before continuing.
