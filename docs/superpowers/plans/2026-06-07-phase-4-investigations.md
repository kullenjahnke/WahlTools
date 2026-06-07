# Phase 4 — Investigations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Product-focused Price History page (fixing the broken chart), a topbar user menu, and a real Settings page (password/email/theme/authorized).

**Architecture:** History becomes a single product-centric client view using real `RETAILERS`/colors + chart theme. The topbar collapses account actions into a shadcn `DropdownMenu`. Settings uses Supabase Auth `updateUser` with react-hook-form + Zod.

**Tech Stack:** Recharts, shadcn DropdownMenu/AlertDialog, Supabase Auth, react-hook-form + Zod.

---

## File structure

- Create: `src/components/prices/product-history-view.tsx` — picker + chart + ranges + stats + change log.
- Modify: `src/app/(dashboard)/dashboard/prices/history/page.tsx` — use the new view, drop `PriceAnalytics`.
- Delete: `src/components/prices/price-history-view.tsx` (broken/replaced).
- Create: `src/components/layout/user-menu.tsx` — account dropdown.
- Modify: `src/components/layout/app-topbar.tsx` — render `UserMenu`.
- Modify/replace: `src/components/auth/sign-out-button.tsx` — keep a `signOut()` action used by the menu, add confirm.
- Rewrite: `src/app/(dashboard)/dashboard/settings/page.tsx` + create `src/components/settings/account-settings.tsx`.

---

### Task 1: Price History — product-focused view

**Files:**
- Create: `src/components/prices/product-history-view.tsx`
- Modify: `src/app/(dashboard)/dashboard/prices/history/page.tsx`
- Delete: `src/components/prices/price-history-view.tsx`

- [ ] **Step 1: Build `product-history-view.tsx`** (client). Props: `products: (Product & { prices?: Price[] })[]`. State: `selectedId`, `range: "4w"|"3m"|"1y"|"all"`, `hidden: Set<retailer>`.

Key pieces (use real config + chart theme):

```ts
import { RETAILERS, RETAILER_COLORS } from "@/lib/config/retailers"
import { useChartTheme } from "@/hooks/use-chart-theme"
// chartData: one point per timestamp(day), keys = retailers with a price that day
// stats: current avg (latest per retailer, averaged), lowest, highest, and 12-week % change
// rangeStart: now - {28|90|365}d or null for all; filter prices by it
// lines: RETAILERS.filter(r => !hidden.has(r)).map(r => <Line dataKey={r} stroke={RETAILER_COLORS[r]} dot={false} />)
```

Layout: searchable product picker (image + brand/category `Chip`), 4 stat cards, chart card with range chips + legend toggle chips (`hidden` toggles a retailer), and a change-log table **filtered to `selectedId`** (reuse the price-change-logs shape already loaded by the page, or derive consecutive deltas from the product's prices per retailer).

- [ ] **Step 2: Rewrite the page** to use it and drop `PriceAnalytics`

```tsx
import { ProductHistoryView } from "@/components/prices/product-history-view"
// ...remove PriceAnalytics + PriceHistoryView imports/usage...
<PageContainer>
  <PageHeader title="Price History" breadcrumbs={[{ label: "Prices", href: "/dashboard/prices" }, { label: "History" }]} />
  <ProductHistoryView products={products || []} />
</PageContainer>
```

- [ ] **Step 3: Delete the broken component**

Run: `git rm src/components/prices/price-history-view.tsx`

- [ ] **Step 4: Verify build** — `pnpm lint && pnpm build` (ensure nothing else imports the deleted file: `grep -r price-history-view src` returns nothing).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(history): product-focused price history with working multi-retailer chart

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Topbar user menu

**Files:**
- Create: `src/components/layout/user-menu.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Modify: `src/components/auth/sign-out-button.tsx`

- [ ] **Step 1: Ensure shadcn primitives exist** — if `src/components/ui/dropdown-menu.tsx` and `src/components/ui/alert-dialog.tsx` are missing, add them:

Run: `pnpm dlx shadcn@latest add dropdown-menu alert-dialog`

- [ ] **Step 2: Create `user-menu.tsx`** — a `DropdownMenu` triggered by an avatar/email button containing: the email (header), a theme submenu or the existing `ThemeToggle`, a `Settings` link (`/dashboard/settings`), and **Sign out** that opens an `AlertDialog` confirm calling the sign-out handler.

```tsx
"use client"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
// ...DropdownMenu with: email, ThemeToggle, <Link href="/dashboard/settings">Settings</Link>,
//    AlertDialog "Sign out?" -> supabase.auth.signOut(); router.push("/login")
```

- [ ] **Step 3: Update `app-topbar.tsx`** to render `<UserMenu email={email} />` instead of the inline email + ThemeToggle + SignOutButton.

```tsx
import { UserMenu } from "@/components/layout/user-menu"
// ...<div className="flex items-center gap-1.5"><UserMenu email={email} /></div>
```

- [ ] **Step 4: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): topbar user menu with settings link + confirmed sign-out

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Settings page

**Files:**
- Rewrite: `src/app/(dashboard)/dashboard/settings/page.tsx`
- Create: `src/components/settings/account-settings.tsx`

- [ ] **Step 1: Server page** loads the current user and renders the client form

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccountSettings } from "@/components/settings/account-settings"

export const metadata = { title: "WahlTools | Settings" }
export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <AccountSettings email={user?.email ?? ""} />
    </PageContainer>
  )
}
```

- [ ] **Step 2: `account-settings.tsx`** (client) — three cards using react-hook-form + Zod + `useToast`:
  - **Account**: current email (read-only) + **Change email** form (`supabase.auth.updateUser({ email })` → toast "Confirmation sent").
  - **Password**: new + confirm (Zod: min 8, match) → `supabase.auth.updateUser({ password })`.
  - **Appearance**: Light/Dark/System via `next-themes` `useTheme().setTheme`.
  - **Authorized status**: read-only line ("This account is authorized").

```ts
import { z } from "zod"
const pwSchema = z.object({ password: z.string().min(8), confirm: z.string() })
  .refine(v => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
const emailSchema = z.object({ email: z.string().email() })
```

- [ ] **Step 3: Verify build** — `pnpm lint && pnpm build`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(settings): account page (email/password/theme/authorized)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Phase exit

- [ ] `pnpm lint` clean, `pnpm build` succeeds.
- [ ] Push; update draft PR.
- [ ] **Owner reviews the Vercel preview and approves.** Verify light/dark: History shows a working multi-retailer chart with ranges/stats/legend + product-scoped change log; topbar user menu with Settings + confirmed sign-out; Settings performs email/password change + theme + authorized line.
- [ ] With all phases approved, ask the owner whether to mark the PR ready and merge to `main`.

## Self-review notes
- Spec Phase 4 covered: history product-focused + chart fix + ranges/stats/legend + scoped log + PriceAnalytics removed (T1); topbar user menu + confirmed sign-out (T2); settings password/email/theme/authorized (T3).
- Deletes the broken `price-history-view.tsx`; grep guard in T1 Step 4 prevents dangling imports.
