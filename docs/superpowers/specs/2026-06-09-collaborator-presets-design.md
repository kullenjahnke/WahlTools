# Collaborator Presets (Typeahead) — Design Spec

> **Status:** Approved (2026-06-09). Small enhancement to Phase 3 Feature B (Collaborators + @mentions).
> **Builds on:** [2026-06-08-social-calendar-phase3-design.md](2026-06-08-social-calendar-phase3-design.md) §B and the
> `feature/social-collaborators` branch (PR #12), which added `social_posts.collaborators`, the composer
> `CollaboratorInput`, tile/queue chips, and the Zernio Instagram publish mapping.

## Motivation

Ryan asked whether the composer can fetch real Instagram usernames as he types, so he doesn't worry about
misspelling collaborator handles. **Live Instagram username lookup is not feasible:** Instagram exposes no
public username-*search* API — the Graph API's Business Discovery only returns data for an account whose
exact handle you already supply (via a connected IG Business account), with no typeahead/search endpoint;
Zernio exposes no handle-search endpoint either. (This is why Feature B deliberately used a free-text field —
"we have no IG user graph.")

The practical substitute is a **curated, hand-verified preset list** of the accounts we commonly tag,
surfaced as a **typeahead** so picking from the list makes misspelling impossible. Free-text entry of any
other handle still works exactly as today.

## Scope

**In scope:** a preset datasource + typeahead dropdown in the existing `CollaboratorInput`. **Out of scope
(unchanged from Feature B):** the DB column, `save_social_post` RPC, `SocialPostInput`/server-action
normalization & validation, the 3-cap, tile/queue chips, the Instagram-only gating of the field, and the
Zernio publish mapping. **No new migration, no DB change, no server-action change.**

## Preset data (verified 2026-06-09)

Add to `src/lib/config/social.ts`:

```ts
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

Every handle satisfies the existing client/server rule `^[a-z0-9._]{1,30}$`. The account's *own* handle
`@wahlburgersathome` is intentionally excluded — Instagram does not allow tagging yourself as a collaborator.

Handle sources (live IG, June 2026): @wahlburgers, @markwahlberg, @donniewahlberg, @chefpaulwahlberg,
@jewelosco, @stopandshop, @acmemarkets, @shawssupermarket, @gianteagle, @giantfoodstores, @bigyfoods,
@publix, @safeway.

## UI behavior (`src/components/social/collaborator-input.tsx`)

Extend the existing component into a combobox. Reuse the current `add`/`remove`/`normalize`/`HANDLE_RE`
logic and the 3-cap unchanged; layer a suggestion dropdown on top.

- **Filtering:** while the draft is non-empty, compute matching presets — those whose `label` OR `handle`
  contains the normalized draft (`normalize(draft)`, case-insensitive substring) — **excluding** any preset
  whose `handle` is already in `value`. Show the dropdown only when there is ≥1 match.
- **Rendering:** dropdown below the input, styled like `tag-picker.tsx`'s menu (`rounded-lg border
  border-border bg-popover`, `max-h-` scroll). Group matches under small uppercase headers in the fixed
  order `Family`, `Brand`, `Retailers` (skip empty groups). Each row: `{label}` followed by a muted
  `@{handle}`. Highlighted row uses `bg-accent`.
- **Selecting:** clicking a row, or pressing Enter while a row is highlighted, calls the existing add path
  with the preset's `handle` (so normalize/validate/cap all still apply), then clears the draft and closes
  the dropdown.
- **Keyboard:** ArrowDown/ArrowUp move the highlight across the flattened filtered list (wrapping is not
  required); Enter adds the highlighted preset if one is highlighted, otherwise falls back to the existing
  behavior (add the typed draft) — so the custom-handle path is preserved; Escape closes the dropdown
  without adding; Backspace on an empty draft still removes the last chip (unchanged). Typing resets the
  highlight to "none".
- **Mouse safety:** each dropdown row gets `onMouseDown={(e) => e.preventDefault()}` so clicking a row does
  not blur-commit the partial draft (same guard already used on the chip remove `X`).
- **Dismissal:** click-outside closes the dropdown (reuse the `mousedown` + `rootRef` pattern from
  `tag-picker.tsx`). The component gains a `useRef` root wrapper for this.
- **At cap:** when `value.length >= 3` the input is disabled and no dropdown shows (unchanged).

## Light/dark

Dropdown and rows use design tokens only (`border-border`, `bg-popover`, `text-muted-foreground`,
`hover:bg-accent`, `text-foreground`) — no hardcoded colors — so both themes are covered.

## Files

| File | Change |
|---|---|
| `src/lib/config/social.ts` | Add `CollaboratorPreset` interface + `COLLABORATOR_PRESETS` constant. |
| `src/components/social/collaborator-input.tsx` | Add typeahead dropdown: `rootRef`, highlight state, filtered+grouped suggestions, keyboard nav, click-outside, row mouse-safety. Existing add/normalize/cap logic unchanged. |

No other files. No migration. No server/DB/publish changes.

## Verification

`pnpm lint` + `pnpm build`. Manual smoke: type `mark` → pick **Mark Wahlberg** → `@markwahlberg` chip;
type `shaw` → pick **Shaw's** → `@shawssupermarket`; type a custom handle not in the list + Enter still adds
it; arrow-key navigation + Enter selects; Escape closes; already-added presets disappear from suggestions;
3-cap disables the field; works in light + dark.

## Delivery

Committed onto the `feature/social-collaborators` branch, extending **PR #12** (the input file it modifies
exists only on that branch, and Feature B is not yet merged — so the presets ship in the same cohesive PR).
