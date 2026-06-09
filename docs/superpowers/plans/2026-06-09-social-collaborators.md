# Social Calendar — Feature B: Collaborators + @mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a post carry up to 3 Instagram collaborator usernames (e.g. `shaws`, `chefpaul`), captured in the composer, rendered as chips on the tile/queue, persisted on `social_posts`, and mapped to Zernio's Instagram `platformSpecificData.collaborators` on publish.

**Architecture:** A new `social_posts.collaborators text[]` column (migration 24) flows through the existing `save_social_post` RPC and `SocialPostInput`/`SocialPostRecord` types. A new free-text chip-input component (`collaborator-input.tsx`, modeled on the `tag-picker.tsx` chip pattern) renders in the composer **only when Instagram is a selected platform**. The Phase-2 Zernio client's `buildBody` adds collaborators to the Instagram platform entry only. Facebook ignores them. `@mentions` in captions are plain text — no special handling.

**Tech Stack:** Next.js 15 (App Router) + React 19, TypeScript (strict), Supabase Postgres (RPC via `supabase.rpc`), shadcn/ui (`Chip`, `Input`, `Button`), Tailwind (light + dark).

**Verification convention (project override of TDD):** This repo has **no test runner**. Each task is verified with `pnpm lint` + `pnpm build` and a manual smoke note. There are no unit-test steps.

**Pinned design decisions:**
- **Lowercase on save** — usernames are canonicalized to lowercase (Instagram handles are case-insensitive).
- **Charset/length** — after stripping a leading `@`, trimming, and lowercasing, each username must match `^[a-z0-9._]{1,30}$` (letters, digits, `.`, `_`; 1–30 chars, matching Instagram).
- **3-cap enforced in both UI and action** — the input disables at 3; the server action rejects > 3; the Zernio mapping defensively slices to 3.
- **@mentions** — plain caption text, no parsing (already the case).
- **Out of scope** — in-image photo tagging with x/y coordinates (deferred).

**Branch:** `feature/social-collaborators` off `main`. Commit per task. Open a PR at the end (do not push to `main`).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `migrations/24_social_posts_collaborators.sql` | Create | Add `collaborators` column + `create or replace` of `save_social_post` to persist it. Run manually in Supabase. |
| `src/types/database.ts` | Modify | Add `collaborators` to `social_posts` Row/Insert/Update. |
| `src/app/actions/social.ts` | Modify | Add `collaborators` to `SocialPostInput`; normalize + validate + pass to RPC in `persist`; thread through `duplicateSocialPost`. |
| `src/lib/social/queries.ts` | Modify | Add `collaborators` to `SocialPostRecord`, `SELECT`, `RawRow`, `shape`. |
| `src/components/social/collaborator-input.tsx` | Create | Free-text chip-input (Enter to add), normalize/validate/cap in UI, helper copy. |
| `src/components/social/post-composer-dialog.tsx` | Modify | State + hydrate/reset + conditional render (Instagram only) + include in save & publish-now inputs. |
| `src/components/social/post-tile.tsx` | Modify | Render collaborator chips on the calendar tile. |
| `src/components/social/queue-list.tsx` | Modify | Render collaborator chips on queue rows. |
| `src/lib/publishing/adapter.ts` | Modify | Add `collaborators?: string[]` to `PublishRequest`. |
| `src/lib/publishing/publish-service.ts` | Modify | Add `collaborators` to `DbPost`, `POST_SELECT`, and the `req` it builds. |
| `src/lib/publishing/zernio-client.ts` | Modify | `buildBody`: per-platform `platformSpecificData`; Instagram-only collaborators (sliced to 3). |

---

## Task 1: Database column + RPC + types

**Files:**
- Create: `migrations/24_social_posts_collaborators.sql`
- Modify: `src/types/database.ts:57-105`

- [ ] **Step 1: Write the migration**

Create `migrations/24_social_posts_collaborators.sql`. This adds the column and re-creates `save_social_post` (currently defined in `migrations/20_social_aspect_ratio.sql`) to read `collaborators` out of the `p_post` jsonb. The only changes vs. the existing function are the two `collaborators` lines (insert column list/values + update assignment); everything else is reproduced verbatim so the function stays intact.

```sql
-- Feature B (Collaborators + @mentions): add the collaborators column to
-- social_posts and teach save_social_post to persist it. Usernames are stored
-- without a leading '@' (normalized in the server action). Max 3 is enforced in
-- the action + UI; this column itself is unconstrained for forward-compat.
-- Run manually in the Supabase SQL editor.

alter table social_posts
  add column if not exists collaborators text[] not null default '{}';

create or replace function save_social_post(
  p_post jsonb,
  p_product_ids uuid[],
  p_retailers text[],
  p_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_status := coalesce(p_post->>'status', 'idea');

  if (p_post->>'id') is null then
    insert into social_posts (title, caption, format, status, scheduled_at, posted_at, platforms, notes, aspect_ratio, collaborators)
    values (
      nullif(p_post->>'title',''),
      nullif(p_post->>'caption',''),
      coalesce(p_post->>'format','image'),
      v_status,
      nullif(p_post->>'scheduled_at','')::timestamptz,
      case when v_status = 'posted' then now() else nullif(p_post->>'posted_at','')::timestamptz end,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        array['instagram','facebook']::text[]
      ),
      nullif(p_post->>'notes',''),
      coalesce(p_post->>'aspect_ratio','auto'),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]
      )
    )
    returning id into v_id;
  else
    v_id := (p_post->>'id')::uuid;
    update social_posts set
      title = nullif(p_post->>'title',''),
      caption = nullif(p_post->>'caption',''),
      format = coalesce(p_post->>'format','image'),
      status = v_status,
      scheduled_at = nullif(p_post->>'scheduled_at','')::timestamptz,
      posted_at = case
        when v_status = 'posted' and posted_at is null then now()
        when v_status <> 'posted' then null
        else posted_at end,
      platforms = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        platforms),
      notes = nullif(p_post->>'notes',''),
      aspect_ratio = coalesce(p_post->>'aspect_ratio','auto'),
      collaborators = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]),
      updated_at = now()
    where id = v_id;
  end if;

  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    if exists (
      select 1 from unnest(p_retailers) r
      where r not in ('Jewel-Osco','Stop & Shop','Acme','Shaws','Giant Eagle',
                      'Giant Food Stores','Big Y','Publix','Safeway')
    ) then
      raise exception 'Invalid retailer in %', p_retailers;
    end if;
  end if;

  delete from social_post_products where post_id = v_id;
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into social_post_products (post_id, product_id)
    select v_id, pid from unnest(p_product_ids) pid
    on conflict do nothing;
  end if;

  delete from social_post_retailers where post_id = v_id;
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    insert into social_post_retailers (post_id, retailer)
    select v_id, r from unnest(p_retailers) r
    on conflict do nothing;
  end if;

  delete from social_post_media where post_id = v_id;
  if p_media is not null and jsonb_array_length(p_media) > 0 then
    insert into social_post_media (post_id, url, storage_path, media_type, position)
    select
      v_id,
      elem->>'url',
      elem->>'storage_path',
      coalesce(elem->>'media_type','image'),
      coalesce((elem->>'position')::int, 0)
    from jsonb_array_elements(p_media) elem;
  end if;

  return v_id;
end;
$$;
```

> **Note on update semantics:** when `collaborators` is absent or `[]` in `p_post`, the `coalesce(..., '{}')` resets the column to empty (matching how the action always sends a normalized array). This is intentional — the action is the single source of truth for the value.

- [ ] **Step 2: Add the column to the generated DB types**

In `src/types/database.ts`, add `collaborators` to all three `social_posts` shapes. Add it right after the `platforms` line in each.

Row (after line 67 `platforms: string[]`):
```typescript
          platforms: string[]
          collaborators: string[]
```

Insert (after line 83 `platforms?: string[]`):
```typescript
          platforms?: string[]
          collaborators?: string[]
```

Update (after line 99 `platforms?: string[]`):
```typescript
          platforms?: string[]
          collaborators?: string[]
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS (no type errors; the build does not touch the DB).

- [ ] **Step 4: Run the migration manually in Supabase**

Open the Supabase SQL editor and run the full contents of `migrations/24_social_posts_collaborators.sql`. Confirm `select collaborators from social_posts limit 1;` returns an empty-array column with no error.

> If the executing agent cannot reach Supabase, leave this checkbox unchecked and flag it in the task summary so a human runs it before publish-path smoke testing. Build/lint do not depend on it.

- [ ] **Step 5: Commit**

```bash
git add migrations/24_social_posts_collaborators.sql src/types/database.ts
git commit -m "feat(social): add collaborators column + RPC persistence (Feature B)"
```

---

## Task 2: Server action persistence + query hydration

**Files:**
- Modify: `src/app/actions/social.ts:11-56`, `:171-226`
- Modify: `src/lib/social/queries.ts:12-76`

- [ ] **Step 1: Add `collaborators` to `SocialPostInput`**

In `src/app/actions/social.ts`, extend the interface (after the `platforms` line, currently line 19):

```typescript
export interface SocialPostInput {
  id?: string
  title?: string | null
  caption?: string | null
  format: string
  aspect_ratio: string
  status: string
  scheduled_at?: string | null
  platforms: string[]
  collaborators?: string[]
  notes?: string | null
  productIds: string[]
  retailers: string[]
  media: { url: string; storage_path: string; media_type: string; position: number }[]
}
```

- [ ] **Step 2: Add the normalizer + charset constant**

In `src/app/actions/social.ts`, just below the `BUCKET` constant (line 9), add:

```typescript
const MAX_COLLABORATORS = 3
// Instagram handles: letters, digits, '.', '_'; 1–30 chars. Validated after
// stripping a leading '@', trimming, and lowercasing.
const COLLABORATOR_RE = /^[a-z0-9._]{1,30}$/

function normalizeCollaborators(raw: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw ?? []) {
    const name = r.replace(/^@+/, '').trim().toLowerCase()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}
```

- [ ] **Step 3: Validate + persist collaborators in `persist`**

In `persist` (currently lines 36-56), normalize before validation and pass the normalized array into the RPC. Replace the start of `persist` (from the `const supabase` line through the `supabase.rpc(...)` call) with:

```typescript
async function persist(input: SocialPostInput) {
  const supabase = await createSupabaseServerClient()
  const invalid = validate(input)
  if (invalid) return { success: false as const, error: invalid }

  const collaborators = normalizeCollaborators(input.collaborators)
  if (collaborators.length > MAX_COLLABORATORS) {
    return { success: false as const, error: `Up to ${MAX_COLLABORATORS} collaborators.` }
  }
  if (!collaborators.every((c) => COLLABORATOR_RE.test(c))) {
    return { success: false as const, error: 'Invalid collaborator username.' }
  }

  const { data, error } = await supabase.rpc('save_social_post', {
    p_post: {
      id: input.id ?? null,
      title: input.title ?? null,
      caption: input.caption ?? null,
      format: input.format,
      aspect_ratio: input.aspect_ratio,
      status: input.status,
      scheduled_at: input.scheduled_at ?? null,
      platforms: input.platforms,
      collaborators,
      notes: input.notes ?? null,
    },
    p_product_ids: input.productIds,
    p_retailers: input.retailers,
    p_media: input.media,
  })
```

(Leave the rest of `persist` — the `if (error)` block, the publish branch, the `revalidatePath` calls, and the return — unchanged.)

- [ ] **Step 4: Preserve collaborators when duplicating**

In `duplicateSocialPost` (lines 171-234), include `collaborators` in both the select and the `save_social_post` payload so a duplicated post keeps them.

In the `.select(...)` string (lines 175-180), add `collaborators` to the column list:
```typescript
    .select(
      'title, caption, format, platforms, aspect_ratio, notes, collaborators, ' +
      'social_post_media ( url, storage_path, media_type, position ), ' +
      'social_post_products ( product_id ), ' +
      'social_post_retailers ( retailer )'
    )
```

In the `Src` type (lines 185-195), add the field after `platforms`:
```typescript
    platforms: string[]
    collaborators: string[] | null
```

In the `save_social_post` payload (lines 212-222), add `collaborators` after `platforms`:
```typescript
      platforms: src.platforms,
      collaborators: src.collaborators ?? [],
```

- [ ] **Step 5: Add `collaborators` to `SocialPostRecord` + query**

In `src/lib/social/queries.ts`:

`SocialPostRecord` (add after `platforms: string[]`, line 21):
```typescript
  platforms: string[]
  collaborators: string[]
```

`SELECT` (line 32) — add `collaborators` to the top-level column list:
```typescript
const SELECT = `
  id, title, caption, format, aspect_ratio, status, scheduled_at, posted_at, platforms, collaborators, notes, created_at, updated_at,
  social_post_media ( id, url, storage_path, media_type, position ),
  social_post_products ( product_id, products ( name ) ),
  social_post_retailers ( retailer )
`
```

`RawRow` (add after `platforms: string[]`, line 47):
```typescript
  platforms: string[]
  collaborators: string[] | null
```

`shape` (add after the `platforms` line, line 67):
```typescript
    platforms: row.platforms ?? [],
    collaborators: row.collaborators ?? [],
```

- [ ] **Step 6: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/social.ts src/lib/social/queries.ts
git commit -m "feat(social): persist + normalize collaborators in save action and queries (Feature B)"
```

---

## Task 3: CollaboratorInput component + composer wiring

**Files:**
- Create: `src/components/social/collaborator-input.tsx`
- Modify: `src/components/social/post-composer-dialog.tsx`

- [ ] **Step 1: Create the chip-input component**

Create `src/components/social/collaborator-input.tsx`. This is a free-text token input (Enter or comma to add a chip) — NOT a directory search. It mirrors the `tag-picker.tsx` chip rendering (`Chip` + inline `X`), validates/normalizes the same way the action does, caps at 3 (input disabled at cap), and shows helper copy. Designed for light + dark via tokens (`text-destructive`, `text-muted-foreground`, neutral `Chip`).

```tsx
'use client'

import { useState, type KeyboardEvent } from 'react'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

const MAX = 3
// Mirrors the server action: strip leading '@', trim, lowercase, then validate.
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

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
  const atMax = value.length >= MAX

  function add() {
    const name = normalize(draft)
    if (!name) return
    if (!HANDLE_RE.test(name)) {
      setErr('Letters, numbers, periods, and underscores only.')
      return
    }
    if (value.includes(name)) {
      setDraft('')
      setErr(null)
      return
    }
    if (value.length >= MAX) {
      setErr(`Up to ${MAX} collaborators.`)
      return
    }
    onChange([...value, name])
    setDraft('')
    setErr(null)
  }

  function remove(name: string) {
    onChange(value.filter((c) => c !== name))
    setErr(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="space-y-1.5">
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
                  <X className="size-3 cursor-pointer" onClick={() => remove(c)} />
                </span>
              }
            />
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setErr(null) }}
        onKeyDown={onKeyDown}
        onBlur={add}
        disabled={atMax}
        placeholder={atMax ? 'Maximum 3 collaborators' : 'Add a username, press Enter'}
        className="h-8"
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">
        Collaborators co-author the post — it&apos;s shared to their followers and shows them as a co-author. Instagram only; Business or Creator accounts.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Import the component into the composer**

In `src/components/social/post-composer-dialog.tsx`, add the import after the `TagPicker` import (line 16):

```typescript
import { TagPicker, type ProductOption } from './tag-picker'
import { CollaboratorInput } from './collaborator-input'
```

- [ ] **Step 3: Add collaborators state**

After the `platforms` state (line 52), add:

```typescript
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [collaborators, setCollaborators] = useState<string[]>([])
```

- [ ] **Step 4: Hydrate + reset collaborators**

In the `useEffect` (lines 64-90):

In the `if (post)` branch, after `setPlatforms(...)` (line 72), add:
```typescript
      setPlatforms(post.platforms.length ? post.platforms : ['instagram', 'facebook'])
      setCollaborators(post.collaborators ?? [])
```

In the `else` branch, after `setPlatforms(['instagram', 'facebook'])` (line 83), add:
```typescript
      setPlatforms(['instagram', 'facebook'])
      setCollaborators([])
```

- [ ] **Step 5: Include collaborators in both save paths**

In `handleSave` (the `input` object, lines 140-151), add `collaborators` after `platforms`:
```typescript
      platforms,
      collaborators,
```

In `handlePublishNow` (the `input` object, lines 195-206), add `collaborators` after `platforms`:
```typescript
      platforms,
      collaborators,
```

- [ ] **Step 6: Render the field — Instagram only**

In the JSX, immediately after the closing `</div>` of the "Publish to" block (the platform toggle block ends at line 317, just before the `When` field), insert:

```tsx
            {platforms.includes('instagram') && (
              <div>
                <Label>Collaborators</Label>
                <CollaboratorInput value={collaborators} onChange={setCollaborators} />
              </div>
            )}
```

- [ ] **Step 7: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 8: Manual smoke**

Run `pnpm dev`, open the composer. With Instagram selected the Collaborators field appears; type `@Shaws` + Enter → a `@shaws` chip (lowercased, `@` stripped). Add 3, confirm the input disables. Deselect Instagram → field hides. Save, reopen → chips rehydrate. Toggle dark mode → chips/helper readable.

- [ ] **Step 9: Commit**

```bash
git add src/components/social/collaborator-input.tsx src/components/social/post-composer-dialog.tsx
git commit -m "feat(social): collaborators chip-input in composer, Instagram-only (Feature B)"
```

---

## Task 4: Collaborator chips on tile + queue

**Files:**
- Modify: `src/components/social/post-tile.tsx:48-56`
- Modify: `src/components/social/queue-list.tsx:74-80`

- [ ] **Step 1: Render chips on the calendar tile**

In `src/components/social/post-tile.tsx`, add the `Chip` import after the existing imports (after line 7):

```typescript
import type { SocialPostRecord } from '@/lib/social/queries'
import { Chip } from '@/components/ui/chip'
```

Then, inside the `<span className="min-w-0 flex-1">` block, after the platforms/time `<span>` (closes at line 55), add a collaborators row:

```tsx
        <span className="block truncate text-[10px] text-muted-foreground">
          {post.platforms.map((p) => (p === 'instagram' ? 'IG' : 'FB')).join(' · ')}
          {time ? ` · ${time}` : ''}
        </span>
        {post.collaborators.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {post.collaborators.map((c) => (
              <Chip key={c} tone="neutral" size="sm" label={`@${c}`} />
            ))}
          </span>
        )}
```

- [ ] **Step 2: Render chips on queue rows**

In `src/components/social/queue-list.tsx`, in the metadata row (lines 74-80), after the retailers `.map(...)` line (line 79), add:

```tsx
                {p.product_names.map((n, i) => <Chip key={`${p.id}-pn-${i}`} label={n} tone="auto" colorKey={p.product_ids[i]} size="sm" />)}
                {p.retailers.map((r) => <Chip key={`${p.id}-r-${r}`} label={r} tone="brand" size="sm" />)}
                {p.collaborators.map((c) => <Chip key={`${p.id}-c-${c}`} label={`@${c}`} tone="neutral" size="sm" />)}
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 4: Manual smoke**

In `pnpm dev`: a post with collaborators shows `@username` chips on its calendar tile and its queue row, in both light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add src/components/social/post-tile.tsx src/components/social/queue-list.tsx
git commit -m "feat(social): render collaborator chips on tile + queue (Feature B)"
```

---

## Task 5: Publish mapping to Zernio (Instagram only)

**Files:**
- Modify: `src/lib/publishing/adapter.ts:11-21`
- Modify: `src/lib/publishing/publish-service.ts:10-23`, `:96-102`
- Modify: `src/lib/publishing/zernio-client.ts:52-71`

- [ ] **Step 1: Add `collaborators` to `PublishRequest`**

In `src/lib/publishing/adapter.ts`, extend the interface (after the `platforms` field, line 16):

```typescript
export interface PublishRequest {
  caption: string
  /** Ordered media (already cropped/derived). */
  media: PublishMedia[]
  /** Our platform values, e.g. ['instagram','facebook']. */
  platforms: string[]
  /** IG collaborator usernames (no leading '@'); applied to Instagram only, max 3. */
  collaborators?: string[]
  /** Our format: image | carousel | reel | story. Drives per-platform content type. */
  format: string
  /** ISO timestamp for scheduled publishing; omit for publish-now. */
  scheduledFor?: string
}
```

- [ ] **Step 2: Load collaborators in the publish service**

In `src/lib/publishing/publish-service.ts`:

Add to the `DbPost` interface (after `platforms: string[]`, line 13):
```typescript
  platforms: string[]
  collaborators: string[] | null
```

Add to `POST_SELECT` (lines 21-23):
```typescript
const POST_SELECT =
  'id, caption, format, platforms, collaborators, aspect_ratio, scheduled_at, external_ref, ' +
  'social_post_media ( url, storage_path, media_type, position )'
```

Add to the `req` object (lines 96-102, after `platforms`):
```typescript
    const req = {
      caption: post.caption ?? '',
      media: built.media,
      platforms: post.platforms,
      collaborators: post.collaborators ?? [],
      format: post.format,
      scheduledFor: post.scheduled_at ?? undefined,
    }
```

- [ ] **Step 3: Map collaborators per-platform in `buildBody`**

In `src/lib/publishing/zernio-client.ts`, replace `buildBody` (lines 52-71) so `platformSpecificData` is computed per platform and Instagram gets collaborators (sliced to 3). Facebook keeps only the existing content-type data.

```typescript
async function buildBody(req: PublishRequest, publishNow: boolean) {
  const accounts = await resolveAccountIds()
  const basePsd = contentTypeFor(req.format)
  const collaborators = (req.collaborators ?? []).slice(0, 3)
  const missing = req.platforms.filter((p) => !accounts[p])
  if (missing.length > 0) {
    throw new Error(`Not connected for: ${missing.join(', ')}. Connect the account(s) in Zernio first.`)
  }
  const platforms = req.platforms.map((p) => {
    // Collaborators are Instagram-only (Business/Creator usernames); Facebook ignores them.
    const psd =
      p === 'instagram' && collaborators.length > 0
        ? { ...(basePsd ?? {}), collaborators }
        : basePsd
    return {
      platform: p,
      accountId: accounts[p],
      ...(psd ? { platformSpecificData: psd } : {}),
    }
  })

  return {
    content: req.caption,
    mediaItems: req.media.map((m) => ({ type: m.type, url: m.url })),
    platforms,
    ...(publishNow ? { publishNow: true } : { scheduledFor: req.scheduledFor, timezone: 'UTC' }),
  }
}
```

- [ ] **Step 4: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional — requires Zernio + a real publish)**

If a Zernio sandbox is available: schedule/publish a post with Instagram targeted and collaborators set; confirm the outgoing `/posts` body's Instagram platform entry carries `platformSpecificData.collaborators` and the Facebook entry does not. (Otherwise rely on lint/build + the per-platform logic; flag in the task summary that live publish was not exercised.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/publishing/adapter.ts src/lib/publishing/publish-service.ts src/lib/publishing/zernio-client.ts
git commit -m "feat(social): map collaborators to Zernio Instagram platformSpecificData (Feature B)"
```

---

## Final verification & PR

- [ ] **Full build/lint pass**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Confirm migration applied** — `social_posts.collaborators` exists in Supabase (Task 1 Step 4).

- [ ] **Open the PR** (do not push to `main`):

```bash
git push -u origin feature/social-collaborators
gh pr create --title "feat(social): collaborators + @mentions (Phase 3, Feature B)" --body "<summary>"
```

> **Repo gotcha:** `gh pr edit` / `gh pr merge` fail on this repo (classic-projects deprecation). For body edits/merges use the REST API: `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f body=...` and `gh api -X PUT repos/<owner>/<repo>/pulls/<n>/merge`.

---

## Self-Review (completed during planning)

**Spec coverage (§B):**
- `social_posts.collaborators text[] ... default '{}'`, max 3 in action → Task 1 (column) + Task 2 (normalize/cap/validate). ✅
- Composer chip-input, Instagram-only, ≤3, `Chip`s, helper copy, reuse tag-picker pattern → Task 3. ✅
- Chips on tile + queue → Task 4. ✅
- Persist via `SocialPostInput` + `save_social_post` RPC → Task 1 (RPC) + Task 2 (input/action). ✅
- Zernio `buildBody` Instagram `platformSpecificData.collaborators`, cap 3, FB ignores → Task 5. ✅
- @mentions plain text, no handling → no work needed (documented). ✅
- In-image x/y tagging out of scope → excluded. ✅
- Migration `24_social_posts_collaborators.sql`, run manually → Task 1. ✅
- Design calls (lowercase, charset, dual cap) → pinned in header, enforced in Task 2 (action) + Task 3 (UI) + Task 5 (slice). ✅

**Placeholder scan:** none — every code step is concrete.

**Type consistency:** `collaborators` is `string[]` on `SocialPostRecord`/DB Row, `string[] | undefined` on `SocialPostInput`, `string[] | null` on raw rows/DbPost (normalized to `[]` at boundaries); `normalizeCollaborators` in the action and `normalize` in the component apply the same rule (`^@`-strip, trim, lowercase, `^[a-z0-9._]{1,30}$`); the RPC reads `p_post->'collaborators'`. Consistent across tasks.
