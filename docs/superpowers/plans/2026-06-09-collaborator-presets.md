# Collaborator Presets (Typeahead) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated, verified preset list of common Instagram accounts (Wahlberg family, Wahlburgers, the 9 WahlTools retailers) and surface it as a typeahead in the composer's Collaborators field so picking from the list makes misspelling impossible — while free-text entry of any other handle still works.

**Architecture:** A static `COLLABORATOR_PRESETS` config constant (label + exact handle + group) feeds a suggestion dropdown layered onto the existing `CollaboratorInput`. The component keeps its current normalize/validate/3-cap/add/remove logic untouched and adds filtering, keyboard navigation, grouped rendering, and click-outside dismissal. No DB, server-action, or publish changes; no migration.

**Tech Stack:** Next.js 15 + React 19 (client component, `useState`/`useEffect`/`useMemo`/`useRef`), TypeScript (strict), shadcn/ui (`Chip`, `Input`), Tailwind tokens (light + dark).

**Verification convention (project override of TDD):** No test runner. Each task is verified with `pnpm lint` + `pnpm build` and a manual smoke note. No unit-test steps.

**Branch:** Commit onto the existing `feature/social-collaborators` branch, extending PR #12 (the component it modifies exists only on that branch; Feature B is not yet merged).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/config/social.ts` | Modify | Add `CollaboratorPreset` interface + `COLLABORATOR_PRESETS` constant (the verified datasource). |
| `src/components/social/collaborator-input.tsx` | Modify (full rewrite) | Add the typeahead dropdown (filter, group, keyboard nav, click-outside, row mouse-safety) over the existing chip-input. |

---

## Task 1: Preset datasource

**Files:**
- Modify: `src/lib/config/social.ts` (append at end of file, after `postLabel`)

- [ ] **Step 1: Add the preset type + constant**

Append to `src/lib/config/social.ts` (after the `postLabel` function, currently the last export at line 69-71):

```typescript

// Curated collaborator presets for the composer's typeahead. Live Instagram
// username search isn't available (no public search API / no IG user graph), so
// this hand-verified list is the practical substitute. `handle` is the exact IG
// username (no leading '@'); every one satisfies ^[a-z0-9._]{1,30}$. The app's
// own account (@wahlburgersathome) is intentionally excluded — you can't tag
// yourself as a collaborator. Handles verified live, June 2026.
export interface CollaboratorPreset {
  /** Friendly display name shown in the dropdown. */
  label: string
  /** Exact Instagram handle (no leading '@'); inserted on select. */
  handle: string
  group: 'Family' | 'Brand' | 'Retailers'
}

export const COLLABORATOR_PRESETS: CollaboratorPreset[] = [
  { label: 'Wahlburgers',       handle: 'wahlburgers',      group: 'Brand' },
  { label: 'Mark Wahlberg',     handle: 'markwahlberg',     group: 'Family' },
  { label: 'Donnie Wahlberg',   handle: 'donniewahlberg',   group: 'Family' },
  { label: 'Paul Wahlberg',     handle: 'chefpaulwahlberg', group: 'Family' },
  { label: 'Jewel-Osco',        handle: 'jewelosco',        group: 'Retailers' },
  { label: 'Stop & Shop',       handle: 'stopandshop',      group: 'Retailers' },
  { label: 'Acme',              handle: 'acmemarkets',      group: 'Retailers' },
  { label: "Shaw's",            handle: 'shawssupermarket', group: 'Retailers' },
  { label: 'Giant Eagle',       handle: 'gianteagle',       group: 'Retailers' },
  { label: 'Giant Food Stores', handle: 'giantfoodstores',  group: 'Retailers' },
  { label: 'Big Y',             handle: 'bigyfoods',        group: 'Retailers' },
  { label: 'Publix',            handle: 'publix',           group: 'Retailers' },
  { label: 'Safeway',           handle: 'safeway',          group: 'Retailers' },
]
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS (the constant is referenced by Task 2; on its own it's an unused export, which is allowed — Next/ESLint does not flag unused exports).

- [ ] **Step 3: Commit**

```bash
git add src/lib/config/social.ts
git commit -m "feat(social): add curated collaborator presets datasource"
```

---

## Task 2: Typeahead dropdown in CollaboratorInput

**Files:**
- Modify: `src/components/social/collaborator-input.tsx` (full-file replacement)

- [ ] **Step 1: Replace the component with the typeahead version**

Replace the ENTIRE contents of `src/components/social/collaborator-input.tsx` with:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { COLLABORATOR_PRESETS, type CollaboratorPreset } from '@/lib/config/social'

const MAX = 3
// Mirrors the server action: strip leading '@', trim, lowercase, then validate.
const HANDLE_RE = /^[a-z0-9._]{1,30}$/
// Fixed display order for grouped suggestions.
const GROUP_ORDER: CollaboratorPreset['group'][] = ['Family', 'Brand', 'Retailers']

function normalize(raw: string): string {
  return raw.replace(/^@+/, '').trim().toLowerCase()
}

export function CollaboratorInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const atMax = value.length >= MAX

  // Presets matching the draft (by label or handle), excluding already-added
  // ones, sorted into the fixed group order. `sort` is stable, so config order
  // is preserved within each group.
  const matches = useMemo(() => {
    const q = normalize(draft)
    if (!q) return []
    return COLLABORATOR_PRESETS
      .filter((p) => !value.includes(p.handle) && (p.label.toLowerCase().includes(q) || p.handle.includes(q)))
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
  }, [draft, value])

  const showDropdown = open && !atMax && matches.length > 0

  // Close the dropdown on click-outside (mousedown fires before input blur).
  useEffect(() => {
    if (!showDropdown) return
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showDropdown])

  // Add a handle through the shared normalize/validate/cap path. Used by both
  // free-text entry (the draft) and preset selection (an exact handle).
  function commit(raw: string) {
    const name = normalize(raw)
    if (!name) return
    if (!HANDLE_RE.test(name)) {
      setErr('Letters, numbers, periods, and underscores only.')
      return
    }
    if (value.includes(name)) {
      setDraft(''); setErr(null); setOpen(false); setHighlight(-1)
      return
    }
    if (value.length >= MAX) {
      setErr(`Up to ${MAX} collaborators.`)
      return
    }
    onChange([...value, name])
    setDraft(''); setErr(null); setOpen(false); setHighlight(-1)
  }

  function remove(name: string) {
    onChange(value.filter((c) => c !== name))
    setErr(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      // Enter on a highlighted suggestion picks it; otherwise add the typed text.
      if (e.key === 'Enter' && highlight >= 0 && matches[highlight]) {
        commit(matches[highlight].handle)
      } else {
        commit(draft)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((c) => (
            <Chip
              key={c}
              tone="neutral"
              size="sm"
              label={
                <span className="flex items-center gap-1">
                  @{c}
                  <X
                    className="size-3 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => remove(c)}
                  />
                </span>
              }
            />
          ))}
        </div>
      )}

      <Input
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setErr(null); setOpen(true); setHighlight(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        disabled={atMax}
        placeholder={atMax ? 'Maximum 3 collaborators' : 'Search or type a username…'}
        className="h-8"
      />

      {showDropdown && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {GROUP_ORDER.map((g) => {
            const items = matches.filter((p) => p.group === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase text-muted-foreground">{g}</p>
                {items.map((p) => {
                  const idx = matches.indexOf(p)
                  return (
                    <button
                      type="button"
                      key={p.handle}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => commit(p.handle)}
                      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${idx === highlight ? 'bg-accent' : 'hover:bg-accent'}`}
                    >
                      <span className="text-foreground">{p.label}</span>
                      <span className="text-xs text-muted-foreground">@{p.handle}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">
        Collaborators co-author the post — it&apos;s shared to their followers and shows them as a co-author. Instagram only; Business or Creator accounts.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS (no unused imports; `useEffect`/`useMemo`/`useRef` all used).

- [ ] **Step 3: Manual smoke**

Run `pnpm dev`, open the composer with Instagram selected:
- Type `mark` → dropdown shows **Family › Mark Wahlberg @markwahlberg**; click it → `@markwahlberg` chip.
- Type `shaw` → **Retailers › Shaw's @shawssupermarket**; ↓ then Enter → `@shawssupermarket` chip.
- Type a handle not in the list (e.g. `someguy`) + Enter → still adds `@someguy` (free-text path preserved).
- Already-added presets no longer appear in suggestions. Esc closes the dropdown; clicking outside closes it.
- Add 3 → input disables, no dropdown. Toggle dark mode → dropdown rows/headers readable.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/collaborator-input.tsx
git commit -m "feat(social): typeahead preset suggestions in collaborators field"
```

---

## Self-Review (completed during planning)

**1. Spec coverage:**
- Preset datasource (13 verified entries, label/handle/group, own-account excluded) → Task 1. ✅
- Filter by label OR handle, exclude already-added, show only with ≥1 match → Task 2 `matches` + `showDropdown`. ✅
- Grouped rendering in fixed `Family`/`Brand`/`Retailers` order, skip empty groups, `{label}` + muted `@{handle}` → Task 2 dropdown. ✅
- Select via click or Enter-on-highlight routes through the existing add/normalize/cap path → `commit`. ✅
- Keyboard: ↓/↑ highlight, Enter picks highlighted else adds draft, Esc closes, Backspace removes last → `onKeyDown`. ✅
- Row `onMouseDown` preventDefault (no blur-commit) → present on each row and the chip X. ✅
- Click-outside closes (mousedown + rootRef) → `useEffect`. ✅
- At cap: disabled, no dropdown → `atMax` gates input + `showDropdown`. ✅
- Light/dark tokens only (`border-border`, `bg-popover`, `text-muted-foreground`, `hover:bg-accent`, `bg-accent`, `text-foreground`) → dropdown markup. ✅
- Unchanged: server normalize/validate/persist, 3-cap, tile/queue chips, IG-only gating, Zernio mapping → no other files touched. ✅

**2. Placeholder scan:** none — full file content provided.

**3. Type consistency:** `CollaboratorPreset` (label/handle/group) defined in Task 1 and imported in Task 2; `matches` is `CollaboratorPreset[]`; `commit(raw: string)` is the single add path; `GROUP_ORDER` typed as `CollaboratorPreset['group'][]`. `matches.indexOf(p)` is valid (same object refs from the memoized array). Consistent.
