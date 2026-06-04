# UI Overhaul — Design Spec (Phase 5)

**Date:** 2026-06-04
**Phase:** 5 of the WahlTools engagement — **research + design only; no implementation code.**
**Status:** Approved direction; this spec feeds a detailed implementation plan (executed later, in its own session).

## Goal

Elevate WahlTools from a functional-but-generic shadcn default look to a polished, professional, Linear/Vercel-style minimal interface — with a first-class dark mode — while preserving all existing functionality and the monochrome + green (`#44B549`) brand.

## Design direction (decided)

- **Aesthetic:** Linear / Vercel minimal — monochrome neutrals, generous whitespace, hairline borders, crisp typography, color used only for meaning.
- **Navigation:** collapsible left sidebar (icon-collapse) replacing the current top nav.
- **Dark mode:** follows system preference by default, with a manual toggle, persisted per device. Driven entirely by design tokens.
- **Density:** compact / data-dense tables and lists (this is a pricing tool).
- **Typography:** replace Geist with **Inter Tight** (`next/font/google`), with a tuned type scale (tighter heading letter-spacing, adjusted line-heights, tabular figures for prices).
- **Brand:** monochrome black/white base; `#44B549` green as the single semantic accent (primary actions, active states, positive deltas).

## Implementation approach (decided)

**Token-first refactor on the existing shadcn/Radix base.** Redefine design tokens (CSS variables in `globals.css` + Tailwind theme), restyle the shared UI primitives once, then sweep pages. Dark mode derives from the tokens. No component-library replacement, no new heavy dependencies (only `next-themes` for theme management, and the Inter Tight font). Lowest risk, incremental, each phase independently shippable.

Rejected: rebuilding primitives from scratch (effort/risk), and page-by-page restyling without tokens (inconsistency/debt, painful dark mode).

## Reference research (Mobbin, web)

Concrete production references anchoring each surface:

- **Dashboard & charts:** [Neon](https://mobbin.com/screens/cf45e7bf-4a0e-40cc-9db5-a29845b58d4e) (dark sidebar dashboard, monochrome charts, stat cards), [Supabase](https://mobbin.com/screens/357c9178-87d7-40f7-85b0-3a5e4159f6a6) (minimal reports, green accent, icon nav), [Basedash](https://mobbin.com/screens/190a82d9-8013-45c6-b768-5cc7d0cc2a7b).
- **Data tables (compact):** [Fey](https://mobbin.com/screens/08c97ee6-5818-4bcc-ae01-2e2a751c1323) (dense dark financial screener — primary reference for the retailer price grid), [Midday](https://mobbin.com/screens/1f5bafec-56bc-4dd4-8003-5f21ec845a2d) (filters, bulk actions, category dropdown), [Causal](https://mobbin.com/screens/3cff10a8-683f-4797-a0d5-7c43131fe733), [YNAB](https://mobbin.com/screens/62817fae-ab1b-43cf-a15d-3d372afd32ca) (grouped rows — comparison view).
- **Sidebar navigation:** [Neon](https://mobbin.com/screens/cf45e7bf-4a0e-40cc-9db5-a29845b58d4e), [Supabase](https://mobbin.com/screens/357c9178-87d7-40f7-85b0-3a5e4159f6a6), [Perplexity Finance](https://mobbin.com/screens/5a1c1309-5922-4ecf-821e-070bd2bb7b19).
- **Modals/dialogs:** [SavvyCal](https://mobbin.com/screens/19ebc6c0-7561-4595-b673-90836b4fc3ef) (clean centered modal with toggles), [Square](https://mobbin.com/screens/2bc10980-6a5d-4c26-ac32-abaea09f6fcd) (tabbed settings modal).

## Foundation — design tokens

- **Color:** neutral gray scale (Linear/Vercel-style; near-black `#0a0a0a`–white with ~10 steps); `#44B549` accent with hover/active/subtle variants; plus warning and destructive tokens. **Price deltas use neutral directional treatment** (▲/▼ glyphs + muted foreground), *not* red/green good/bad semantics — the user is not the consumer, so a price moving up/down isn't inherently good or bad. The green accent stays reserved for primary actions and active states; a low-opacity green tint may be used only where it genuinely improves hierarchy. Light + dark pairs as HSL CSS variables in `globals.css`; Tailwind `darkMode: "class"` already set.
- **Typography:** Inter Tight; headings tracking ~`-0.02em`, body `-0.01em`; line-heights ~1.2 (headings) / 1.5 (body); `font-variant-numeric: tabular-nums` on price/number cells; defined type scale (display/h1–h4/body/caption).
- **Radius:** ~6–8px (tighter than current). **Borders:** 1px hairline using a border token. **Shadows:** minimal, low-spread; rely on borders over shadows.
- **Spacing:** compact scale; tighter table row height and card padding.

## App shell

- Collapsible left sidebar: brand mark at top, grouped nav (Overview, Products, Prices, Comparison, Analytics, Settings), collapse-to-icons control, user/account footer.
- Slim top bar within content area: current page title/breadcrumb, theme toggle, user menu.
- Responsive: sidebar becomes a sheet/drawer on mobile (reuse existing mobile-nav pattern, restyled).

## Components (restyle on shadcn primitives)

Buttons, inputs, selects, textareas, cards, badges, tabs, dropdown-menus, dialogs, tooltips, skeletons, toasts — flatter surfaces, hairline borders, subtle hover, accent reserved for primary/active. (Note: some unused primitives were removed in Phase 2; re-add via shadcn only where the redesign needs them, e.g. dropdown-menu for the user menu.)

## Data tables & charts

- **Tables:** sticky header, dense rows, row hover, zebra optional, sortable headers, inline status/promotion badges, a filter/search bar, optional bulk actions; tabular figures for prices. Targets: retailer price table, history, comparison, products list.
- **Charts:** restyle Recharts — monochrome gridlines, accent series, minimal axes, clean tooltips, consistent palette token. Targets: price history, trends, analytics.

## Modals

Centered dialogs with a clear header / scrollable body / footer-actions structure; restrained styling; consistent sizing. Targets: export modal, and any future settings/edit dialogs.

## Dark mode

`next-themes` provider in the root layout; `defaultTheme="system"`, `enableSystem`, class strategy; toggle in the top bar; persisted in localStorage. All colors come from token pairs so no per-component dark overrides are needed (audit for hard-coded `gray-*`/`white` utilities and migrate them to tokens — the current dashboard cards use hard-coded gradients that must be tokenized).

## Scope

**In scope:** every authenticated route (dashboard, products, prices + sub-pages, comparison, analytics, settings, competitors, auth pages), the app shell, shared primitives, tables, charts, modals, typography, dark mode.

**Out of scope (YAGNI):** new features/pages, data-model changes, the marketing/landing `/` page beyond basic theming, the (legacy) competitor redirect routes, re-architecting state management.

## Phasing (overview; detailed in the implementation plan)

1. Foundation — tokens, Inter Tight, Tailwind theme, `next-themes`, dark-mode plumbing.
2. App shell — sidebar + top bar + theme toggle.
3. Core primitives restyle.
4. Data tables (compact) + charts.
5. Modals + remaining components.
6. Page sweep — apply shell/components per route; tokenize hard-coded colors.
7. QA — light/dark visual pass, responsive, accessibility (contrast, focus states), build/lint.

Each phase is independently shippable and visually verifiable.
