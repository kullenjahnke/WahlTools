# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PHASE-5 NOTE:** This document is the *deliverable* of Phase 5 (research + plan). It is intended to be **executed in a later, dedicated session**. The code blocks below are the target implementation to apply *then* — do not treat this plan's existence as implementation.

**Goal:** Restyle WahlTools into a polished Linear/Vercel-style minimal interface with a collapsible sidebar, Inter Tight typography, compact data-dense tables, and a token-driven dark mode — without changing functionality.

**Architecture:** Token-first refactor on the existing shadcn/Radix base. Redefine CSS-variable tokens + Tailwind theme, add `next-themes`, restyle shared primitives once, then sweep pages. Dark mode and the green brand accent derive entirely from tokens.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind 3.4 (`darkMode: "class"`), shadcn/Radix, Recharts, `next-themes` (new), Inter Tight via `next/font/google`.

**Verification model:** This project has no test framework (out of scope per the spec). Each task verifies with `pnpm build` + `pnpm lint` and a **manual light/dark visual check** via `pnpm dev`. Accessibility checks (focus rings, contrast) are part of the final QA phase.

**Reference set (Mobbin):** dashboard/charts — Neon, Supabase, Basedash; tables — Fey, Midday; sidebar — Neon, Supabase, Perplexity; modals — SavvyCal, Square. Links are in the design spec (`docs/superpowers/specs/2026-06-04-ui-overhaul-design.md`).

---

## File Structure (created / modified)

| File | Responsibility |
|---|---|
| `src/app/globals.css` | Token definitions (light + dark), base typography, remove Arial rule, consolidate duplicate `@layer base` |
| `tailwind.config.ts` | Map new tokens (brand, sidebar), font family, radius |
| `src/app/layout.tsx` | Inter Tight font, `ThemeProvider`, body classes |
| `src/components/theme/theme-provider.tsx` | (new) `next-themes` wrapper (client) |
| `src/components/theme/theme-toggle.tsx` | (new) light/dark/system toggle (client) |
| `src/components/layout/app-sidebar.tsx` | (new) collapsible sidebar |
| `src/components/layout/app-topbar.tsx` | (new) page top bar with title + toggle + user menu |
| `src/app/(dashboard)/dashboard/layout.tsx` | Replace header shell with sidebar + topbar |
| `src/components/ui/*.tsx` | Restyle primitives (button, input, card, badge, tabs, table, dialog, etc.) |
| `src/components/ui/dropdown-menu.tsx` | (re-add via shadcn) for user menu + theme toggle |
| Page files under `src/app/(dashboard)/**` | Tokenize hard-coded colors; apply restyled components |

---

## Phase 1 — Foundation (tokens, font, dark-mode plumbing)

### Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Add next-themes**

Run: `pnpm add next-themes`
Expected: `next-themes` in dependencies.

- [ ] **Step 2: Re-add the dropdown-menu primitive (removed in Phase 2; needed for user menu + theme toggle)**

Run: `pnpm dlx shadcn@latest add dropdown-menu`
Expected: `src/components/ui/dropdown-menu.tsx` recreated.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/dropdown-menu.tsx
git commit -m "ui: add next-themes and dropdown-menu primitive"
```

### Task 2: Design tokens

**Files:** `src/app/globals.css`

- [ ] **Step 1: Replace the top of the file (remove the Arial rule; it overrides the layout font)**

Replace lines 1–7:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: Arial, Helvetica, sans-serif;
}
```
with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Replace the `:root` and `.dark` token blocks** with the refined Linear/Vercel neutrals + green brand token. The green `#44B549` ≈ `123 45% 49%` in HSL.

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.5%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.5%;
    --muted-foreground: 0 0% 42%;
    --accent: 0 0% 96.5%;          /* shadcn neutral hover bg — keep neutral */
    --accent-foreground: 0 0% 9%;
    --brand: 123 45% 49%;          /* #44B549 — semantic green */
    --brand-foreground: 0 0% 100%;
    --brand-muted: 123 45% 49% / 0.12; /* low-opacity tint */
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 91%;
    --input: 0 0% 91%;
    --ring: 0 0% 9%;
    /* charts: monochrome-leaning with brand as series-1 */
    --chart-1: 123 45% 49%;
    --chart-2: 0 0% 45%;
    --chart-3: 0 0% 65%;
    --chart-4: 0 0% 30%;
    --chart-5: 123 30% 70%;
    --radius: 0.5rem;
    /* sidebar */
    --sidebar: 0 0% 99%;
    --sidebar-foreground: 0 0% 25%;
    --sidebar-border: 0 0% 91%;
    --sidebar-accent: 0 0% 95%;
    --sidebar-accent-foreground: 0 0% 9%;
  }
  .dark {
    --background: 0 0% 6%;
    --foreground: 0 0% 95%;
    --card: 0 0% 8%;
    --card-foreground: 0 0% 95%;
    --popover: 0 0% 8%;
    --popover-foreground: 0 0% 95%;
    --primary: 0 0% 95%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14%;
    --secondary-foreground: 0 0% 95%;
    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 60%;
    --accent: 0 0% 16%;
    --accent-foreground: 0 0% 95%;
    --brand: 123 45% 52%;
    --brand-foreground: 0 0% 8%;
    --brand-muted: 123 45% 52% / 0.16;
    --destructive: 0 62% 45%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 16%;
    --input: 0 0% 18%;
    --ring: 0 0% 70%;
    --chart-1: 123 45% 52%;
    --chart-2: 0 0% 65%;
    --chart-3: 0 0% 45%;
    --chart-4: 0 0% 80%;
    --chart-5: 123 30% 45%;
    --sidebar: 0 0% 8%;
    --sidebar-foreground: 0 0% 70%;
    --sidebar-border: 0 0% 16%;
    --sidebar-accent: 0 0% 14%;
    --sidebar-accent-foreground: 0 0% 95%;
  }
}
```

- [ ] **Step 3: Consolidate the duplicate `@layer base` blocks** (the file currently has two near-identical ones) into one:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings: "cv11", "ss01";
  }
  /* Tabular figures for price/number cells */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: `✓ Compiled successfully` (no visual change yet beyond colors).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "ui: refine design tokens + add brand/sidebar tokens, remove Arial override"
```

### Task 3: Tailwind theme — fonts, brand, sidebar, radius

**Files:** `tailwind.config.ts`

- [ ] **Step 1: Add brand + sidebar colors** inside `theme.extend.colors` (after the `chart` block):

```ts
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          muted: 'hsl(var(--brand-muted))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        },
```

- [ ] **Step 2: Add the font family** inside `theme.extend` (a sibling of `colors`):

```ts
      fontFamily: {
        sans: ['var(--font-inter-tight)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
      },
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm build` → Expected: success.
```bash
git add tailwind.config.ts
git commit -m "ui: wire brand/sidebar colors and Inter Tight font family in tailwind"
```

### Task 4: Inter Tight font + ThemeProvider in root layout

**Files:** `src/app/layout.tsx`, `src/components/theme/theme-provider.tsx`

- [ ] **Step 1: Create the theme provider**

`src/components/theme/theme-provider.tsx`:
```tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 2: Rewrite `src/app/layout.tsx`** to use Inter Tight and wrap with the provider (keep the existing `metadata` block from Phase 4):

```tsx
import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

// (keep the existing `export const metadata` object unchanged)

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${interTight.variable} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify** — Run `pnpm build` (success) and `pnpm dev`; confirm the app renders in Inter Tight and respects OS dark/light.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/theme/theme-provider.tsx
git commit -m "ui: Inter Tight font + next-themes provider (system default)"
```

### Task 5: Theme toggle

**Files:** `src/components/theme/theme-toggle.tsx`

- [ ] **Step 1: Create the toggle** (uses the re-added dropdown-menu + lucide Sun/Moon):

```tsx
"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Verify + commit** — `pnpm build`; then:
```bash
git add src/components/theme/theme-toggle.tsx
git commit -m "ui: add theme toggle (light/dark/system)"
```

**Phase 1 verification:** light/dark switch works app-wide via OS + (once wired in Phase 2) the toggle; font is Inter Tight; build + lint clean.

---

## Phase 2 — App shell (sidebar + top bar)

### Task 6: Collapsible sidebar

**Files:** `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Build the sidebar** — persistent on `md+`, collapsible to icons, grouped nav, brand mark at top, account/email + sign-out at the bottom. Reference Neon/Supabase. Nav items (reuse current routes from `main-nav.tsx`):

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { WahltoolsLogo } from "@/components/icons/wahltools-logo"
import {
  LayoutDashboard, Package, Tags, GitCompareArrows, LineChart, Settings,
  PanelLeftClose, PanelLeft,
} from "lucide-react"

const NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { title: "Products", href: "/dashboard/products", icon: Package, match: ["/dashboard/products"] },
  { title: "Prices", href: "/dashboard/prices", icon: Tags, match: ["/dashboard/prices"] },
  { title: "Comparison", href: "/dashboard/comparison", icon: GitCompareArrows, match: ["/dashboard/comparison"] },
  { title: "Analytics", href: "/dashboard/analytics", icon: LineChart, match: ["/dashboard/analytics"] },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, match: ["/dashboard/settings"] },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const isActive = (item: (typeof NAV)[number]) =>
    item.match.some((m) => pathname === m || (m !== "/dashboard" && pathname.startsWith(m)))

  return (
    <aside className={cn(
      "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width]",
      collapsed ? "w-16" : "w-60",
    )}>
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <WahltoolsLogo className="h-5 w-auto shrink-0" />
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive(item)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/60",
              )}>
              <Icon className={cn("h-4 w-4 shrink-0", isActive(item) && "text-brand")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          )
        })}
      </nav>
      <button onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-3 px-4 py-3 border-t border-sidebar-border text-sm hover:bg-sidebar-accent/60">
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "ui: add collapsible app sidebar"
```

### Task 7: Top bar (title + theme toggle + account)

**Files:** `src/components/layout/app-topbar.tsx`

- [ ] **Step 1: Build the top bar** — holds the mobile nav trigger, a slot for page title/breadcrumb, the theme toggle, and the existing `SignOutButton`. Reuse `src/components/layout/mobile-nav.tsx` (restyle later) for the mobile drawer.

```tsx
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { MobileNav } from "@/components/layout/mobile-nav"

export function AppTopbar({ email }: { email?: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-2">
        <div className="md:hidden"><MobileNav /></div>
      </div>
      <div className="flex items-center gap-2">
        {email && <span className="hidden sm:inline text-sm text-muted-foreground">{email}</span>}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/layout/app-topbar.tsx
git commit -m "ui: add app top bar with theme toggle"
```

### Task 8: Wire shell into the dashboard layout

**Files:** `src/app/(dashboard)/dashboard/layout.tsx`

- [ ] **Step 1: Replace the current header-based layout** with sidebar + topbar + scrollable content. Keep the existing Supabase auth check and `email` lookup; only the returned JSX shell changes:

```tsx
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar email={email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
```
Add imports for `AppSidebar` and `AppTopbar`; remove the old `MainNav`/header markup. (`email` comes from the existing `user.email`.)

- [ ] **Step 2: Verify** — `pnpm dev`: sidebar shows on desktop, collapses; active item highlights with brand tint; topbar toggle flips theme; mobile shows the drawer; `pnpm build` + `pnpm lint` clean.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/dashboard/layout.tsx"
git commit -m "ui: replace top-nav shell with sidebar + topbar"
```

**Phase 2 verification:** full app shell in place, light/dark, responsive.

---

## Phase 3 — Core primitives restyle

> Restyle the variant definitions inside each shadcn primitive (the `cva` calls). Keep APIs identical so consuming pages don't change. After each, run `pnpm build` and eyeball a page using that primitive in light + dark.

### Task 9: Button

**Files:** `src/components/ui/button.tsx`

- [ ] **Step 1: Update variants** — flatter, hairline, add a `brand` variant for key CTAs; default stays monochrome (primary = near-black/white). Example `variant` map:

```ts
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 px-3 text-xs", lg: "h-10 px-6", icon: "h-9 w-9" },
    },
  }
```
Keep the base classes but ensure `rounded-md`, `text-sm font-medium`, focus-visible ring using `--ring`. Use the `brand` variant for primary CTAs like "Record Prices" and "Send test reminder" during the page sweep.

- [ ] **Step 2: Verify + commit**
```bash
git add src/components/ui/button.tsx
git commit -m "ui: restyle button variants (+brand)"
```

### Task 10: Inputs, selects, textarea

**Files:** `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/textarea.tsx`

- [ ] **Step 1:** Normalize to `h-9`, `rounded-md`, `border-border`, `bg-background`, `text-sm`, `placeholder:text-muted-foreground`, focus ring `ring-ring`. Ensure dark mode reads from tokens (no hard-coded grays).
- [ ] **Step 2: Verify + commit**
```bash
git add src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx
git commit -m "ui: restyle form inputs"
```

### Task 11: Card, badge, tabs

**Files:** `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/tabs.tsx`

- [ ] **Step 1: Card** — `rounded-lg border border-border bg-card`, remove heavy shadow (use `shadow-sm` or none); tighten padding for compact density.
- [ ] **Step 2: Badge** — add `brand` and neutral variants; small, `rounded-full` or `rounded-md`, used for promo/status chips in tables.
- [ ] **Step 3: Tabs** — underline-style active indicator using `border-b-2 border-brand` for the active trigger; muted inactive.
- [ ] **Step 4: Verify + commit**
```bash
git add src/components/ui/card.tsx src/components/ui/badge.tsx src/components/ui/tabs.tsx
git commit -m "ui: restyle card/badge/tabs"
```

**Phase 3 verification:** primitives consistent in light/dark; no consumer breakage (build/lint clean).

---

## Phase 4 — Data tables & charts

### Task 12: Table primitive — compact + sticky

**Files:** `src/components/ui/table.tsx`

- [ ] **Step 1:** Tighten row height (`h-10`), reduce cell padding (`px-3 py-2`), header `text-xs uppercase tracking-tight text-muted-foreground bg-muted/40 sticky top-0`, row `hover:bg-muted/40`, hairline row borders. Add a `tabular-nums` utility on numeric cells where used.
- [ ] **Step 2: Verify + commit**
```bash
git add src/components/ui/table.tsx
git commit -m "ui: compact, sticky-header table primitive"
```

### Task 13: Retailer price table + filters

**Files:** `src/components/prices/retailer-price-table.tsx`, `src/components/prices/retailer-price-overview.tsx`

- [ ] **Step 1:** Apply the compact table; add a filter/search row (retailer + product search) above it; render promo/sold-out as `Badge`; price cells use `tabular-nums`; price deltas use neutral ▲/▼ glyphs with `text-muted-foreground` (no red/green). Reference Fey + Midday.
- [ ] **Step 2: Verify + commit** (visual check on `/dashboard/prices`)
```bash
git add src/components/prices/retailer-price-table.tsx src/components/prices/retailer-price-overview.tsx
git commit -m "ui: restyle retailer price table + filters"
```

### Task 14: Other tables (history, comparison, products)

**Files:** `src/components/prices/price-history-view.tsx`, `src/components/comparison/enhanced-product-comparison.tsx`, `src/components/comparison/price-comparison-table.tsx` (note: this file was removed in Phase 2 — skip if absent), `src/components/products/enhanced-products-list.tsx`

- [ ] **Step 1:** Apply the same compact/table conventions and neutral delta treatment. For comparison, use grouped rows like YNAB.
- [ ] **Step 2: Verify + commit**
```bash
git add -A
git commit -m "ui: restyle history/comparison/products tables"
```

### Task 15: Charts (Recharts restyle)

**Files:** `src/components/prices/price-history-chart.tsx`, `src/components/prices/price-analytics.tsx`, `src/components/prices/product-price-history.tsx`, `src/components/comparison/price-history-comparison-chart.tsx`, `src/components/analytics/product-analytics.tsx`

- [ ] **Step 1:** Switch series/grid/axis colors to read from the chart tokens (`hsl(var(--chart-N))`), brand as series-1; minimal gridlines (`stroke hsl(var(--border))`, dashed, low opacity); axis text `hsl(var(--muted-foreground))` `text-xs`; restyle tooltips to `bg-popover border-border rounded-md`. Reference Neon/Basedash.
- [ ] **Step 2: Verify + commit**
```bash
git add -A
git commit -m "ui: restyle Recharts visuals to tokens"
```

**Phase 4 verification:** tables dense + legible, charts on-brand, light/dark correct.

---

## Phase 5 — Modals & remaining components

### Task 16: Dialog primitive + export modal

**Files:** `src/components/ui/dialog.tsx`, `src/components/prices/export-modal.tsx`

- [ ] **Step 1:** Dialog: centered, `rounded-lg border border-border bg-popover`, clear header/body/footer spacing, restrained overlay (`bg-black/50`). Reference SavvyCal/Square. Apply to the export modal (clean header, grouped options, footer actions).
- [ ] **Step 2: Verify + commit**
```bash
git add src/components/ui/dialog.tsx src/components/prices/export-modal.tsx
git commit -m "ui: restyle dialog + export modal"
```

### Task 17: Remaining primitives (toast, skeleton, tooltip, switch, checkbox, label)

**Files:** `src/components/ui/{toast,toaster,skeleton,tooltip,switch,checkbox,label}.tsx`

> Note: `tooltip` was removed in Phase 2 — re-add via `pnpm dlx shadcn@latest add tooltip` only if a consumer needs it.

- [ ] **Step 1:** Align radii, borders, and token colors; skeleton uses `bg-muted`; toast uses `bg-popover border-border`.
- [ ] **Step 2: Verify + commit**
```bash
git add -A
git commit -m "ui: restyle remaining primitives"
```

**Phase 5 verification:** all shared components consistent.

---

## Phase 6 — Page sweep & tokenization

### Task 18: Tokenize hard-coded colors on the dashboard

**Files:** `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1:** Replace the hard-coded gradient/`gray-*`/`blue-*` card styles (e.g. `bg-gradient-to-br from-white to-gray-50 dark:from-gray-900`, `text-blue-600`) with token-based classes (`bg-card`, `text-muted-foreground`, brand accents only where meaningful). Keep the 4 stat cards but flatten to the new Card style; left accent bars become a subtle `border-l-2 border-brand` only if it improves hierarchy.
- [ ] **Step 2: Verify + commit** (visual on `/dashboard`, light + dark)
```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "ui: tokenize dashboard, apply new card style"
```

### Task 19: Sweep remaining pages

**Files:** all pages under `src/app/(dashboard)/dashboard/**` and `src/app/(auth)/**`

- [ ] **Step 1:** Per page, replace ad-hoc colors (`bg-red-50`, `text-red-600`, `text-gray-*`, hard-coded whites) with tokens; ensure headings use the new type scale (`text-2xl font-semibold tracking-tight` etc.); apply `brand` button variant to the primary action on each page. Pages: prices (+ check/history/reminders/sequential), products (+ new/[id]/view/urls/import), comparison (+ history), analytics, settings, competitors (real pages only), login, register.
- [ ] **Step 2: Verify per page + commit in logical groups**
```bash
git add -A
git commit -m "ui: tokenize + restyle <group> pages"
```

**Phase 6 verification:** no hard-coded color utilities remain (grep `gray-|red-50|to-white|from-gray`); every page reads from tokens.

---

## Phase 7 — QA & polish

### Task 20: Light/dark + responsive pass

- [ ] **Step 1:** Walk every route in light and dark at desktop + mobile widths; fix contrast/spacing issues; confirm sidebar collapse, mobile drawer, and theme persistence across reload.

### Task 21: Accessibility & final checks

- [ ] **Step 1:** Verify visible focus rings (`ring-ring`) on all interactive elements, sufficient contrast (WCAG AA) for muted text and brand-on-white/brand-on-dark, and that the theme toggle has an accessible label.
- [ ] **Step 2:** Run `pnpm build` + `pnpm lint`; grep for leftover `font-family`/hard-coded colors; confirm no console errors in `pnpm dev`.
- [ ] **Step 3: Final commit**
```bash
git add -A
git commit -m "ui: QA polish (contrast, focus, responsive)"
```

**Phase 7 verification:** build + lint clean; visual QA passed in both themes; accessibility checks done.

---

## Out of scope (per spec)
New features/pages, data-model changes, the marketing `/` landing beyond basic theming, legacy competitor redirect routes, state-management changes. No test framework is added.
