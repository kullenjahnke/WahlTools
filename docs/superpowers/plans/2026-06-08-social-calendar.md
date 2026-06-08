# Social Media Calendar (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a month-calendar + queue + composer for planning Wahlburgers at Home social posts (status lifecycle, IG/FB targeting, product/retailer tagging, media upload, daily Resend reminders) — no live publishing.

**Architecture:** New `social_posts` (+ `social_post_media`, `social_post_products`, `social_post_retailers` join tables) in Supabase, written atomically via a `save_social_post` RPC. Server Components fetch posts; a client month-grid renders thumbnail tiles with native drag-to-reschedule; a two-pane Radix dialog composes posts with a live preview. A daily, separately-gated digest reuses the existing Resend + cron infra.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Supabase (`@supabase/ssr`), shadcn/ui + Radix, `react-hook-form` + `zod`, `date-fns`, Resend. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-06-08-social-calendar-design.md](../specs/2026-06-08-social-calendar-design.md).

## Conventions for this plan

- **No test runner exists** in this repo (verification is `pnpm lint` + `pnpm build` + manual preview smoke). Each code task therefore verifies with `pnpm lint` (fast) and commits; `pnpm build` runs at the integration milestones (Tasks 8, 13, 15). The final task does the manual browser smoke.
- **Migrations are run manually in the Supabase SQL editor** — they are not executed by app code. Each migration file says so in its header. After writing Task 1, apply the three files in the SQL editor before exercising the UI (the build does not require them).
- Match existing patterns: server actions return `{ success, error?, data? }`, use `createSupabaseServerClient()`, and `revalidatePath`. Every surface is styled for light **and** dark via design tokens.
- Branch: `feature/social-calendar` (already created). Commit after each task.

---

### Task 1: Database migrations (run manually in Supabase)

**Files:**
- Create: `migrations/16_social_calendar.sql`
- Create: `migrations/17_social_media_bucket.sql`
- Create: `migrations/18_extend_reminder_settings_social.sql`

- [ ] **Step 1: Write `migrations/16_social_calendar.sql`**

```sql
-- Migration 16: Social Media Calendar (v1)
-- Tables for planning social posts + atomic save RPC. No publishing.
-- Run this in the Supabase SQL Editor.

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  caption text,
  format text not null default 'image'
    check (format in ('image','carousel','reel','story')),
  status text not null default 'idea'
    check (status in ('idea','draft','scheduled','posted','failed')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  platforms text[] not null default array['instagram','facebook']::text[]
    check (platforms <@ array['instagram','facebook']::text[]),
  notes text,
  external_ref jsonb,      -- Phase 2: vendor post ids (vendor-agnostic)
  failure_reason text,     -- Phase 2: publish failure detail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_scheduled_at_idx on social_posts (scheduled_at);
create index if not exists social_posts_status_idx on social_posts (status);

create table if not exists social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  url text not null,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists social_post_media_post_idx on social_post_media (post_id, position);

create table if not exists social_post_products (
  post_id uuid not null references social_posts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (post_id, product_id)
);

create table if not exists social_post_retailers (
  post_id uuid not null references social_posts(id) on delete cascade,
  retailer text not null,
  primary key (post_id, retailer)
);

-- RLS: authenticated users have full access (matches the rest of the app).
alter table social_posts enable row level security;
alter table social_post_media enable row level security;
alter table social_post_products enable row level security;
alter table social_post_retailers enable row level security;

drop policy if exists "social_posts_authenticated_all" on social_posts;
create policy "social_posts_authenticated_all" on social_posts
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_media_authenticated_all" on social_post_media;
create policy "social_post_media_authenticated_all" on social_post_media
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_products_authenticated_all" on social_post_products;
create policy "social_post_products_authenticated_all" on social_post_products
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_retailers_authenticated_all" on social_post_retailers;
create policy "social_post_retailers_authenticated_all" on social_post_retailers
  for all to authenticated using (true) with check (true);

-- Atomic upsert: writes the post + replaces its product tags, retailer tags,
-- and media rows in one transaction. Media files must be uploaded to Storage
-- BEFORE calling this; p_media carries their { url, storage_path, media_type,
-- position }. Returns the post id.
create or replace function save_social_post(
  p_post jsonb,
  p_product_ids uuid[],
  p_retailers text[],
  p_media jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_status := coalesce(p_post->>'status', 'idea');

  if (p_post->>'id') is null then
    insert into social_posts (caption, format, status, scheduled_at, posted_at, platforms, notes)
    values (
      nullif(p_post->>'caption',''),
      coalesce(p_post->>'format','image'),
      v_status,
      nullif(p_post->>'scheduled_at','')::timestamptz,
      case when v_status = 'posted' then now() else nullif(p_post->>'posted_at','')::timestamptz end,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        array['instagram','facebook']::text[]
      ),
      nullif(p_post->>'notes','')
    )
    returning id into v_id;
  else
    v_id := (p_post->>'id')::uuid;
    update social_posts set
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
      updated_at = now()
    where id = v_id;
  end if;

  -- Validate retailers against the known set (defense in depth; app also validates).
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    if exists (
      select 1 from unnest(p_retailers) r
      where r not in ('Jewel-Osco','Stop & Shop','Acme','Shaws','Giant Eagle',
                      'Giant Food Stores','Big Y','Publix','Safeway')
    ) then
      raise exception 'Invalid retailer in %', p_retailers;
    end if;
  end if;

  -- Replace product tags.
  delete from social_post_products where post_id = v_id;
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into social_post_products (post_id, product_id)
    select v_id, pid from unnest(p_product_ids) pid
    on conflict do nothing;
  end if;

  -- Replace retailer tags.
  delete from social_post_retailers where post_id = v_id;
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    insert into social_post_retailers (post_id, retailer)
    select v_id, r from unnest(p_retailers) r
    on conflict do nothing;
  end if;

  -- Replace media rows.
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

- [ ] **Step 2: Write `migrations/17_social_media_bucket.sql`**

```sql
-- Migration 17: Storage bucket for social post media.
-- Run this in the Supabase SQL Editor. (next.config.ts already allow-lists
-- the project's /storage/v1/object/public/** path, so no config change.)

insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

-- Public read; authenticated write/update/delete.
drop policy if exists "social_media_public_read" on storage.objects;
create policy "social_media_public_read" on storage.objects
  for select using (bucket_id = 'social-media');

drop policy if exists "social_media_auth_insert" on storage.objects;
create policy "social_media_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'social-media');

drop policy if exists "social_media_auth_update" on storage.objects;
create policy "social_media_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'social-media');

drop policy if exists "social_media_auth_delete" on storage.objects;
create policy "social_media_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'social-media');
```

- [ ] **Step 3: Write `migrations/18_extend_reminder_settings_social.sql`**

```sql
-- Migration 18: Social digest settings on the reminder_settings singleton.
-- Run this in the Supabase SQL Editor.

alter table reminder_settings
  add column if not exists social_reminder_enabled boolean not null default true,
  add column if not exists social_recipients text[] not null
    default array['info@kullenjahnke.com','rjahnke@arkkfood.com'];
```

- [ ] **Step 4: Commit**

```bash
git add migrations/16_social_calendar.sql migrations/17_social_media_bucket.sql migrations/18_extend_reminder_settings_social.sql
git commit -m "feat(social): add social calendar migrations (tables, RPC, bucket, settings)"
```

- [ ] **Step 5: Apply manually** — open the Supabase SQL editor and run `16`, `17`, `18` in order. (Not required for `pnpm build`, but required before the UI can read/write data.)

---

### Task 2: Database types

**Files:**
- Modify: `src/types/database.ts` (add four tables inside `Database["public"]["Tables"]`)

- [ ] **Step 1: Add the table types**

Insert the following entries alongside the existing tables in `Database["public"]["Tables"]` (place after the `products` entry; mind the trailing commas so the object stays valid):

```typescript
      social_posts: {
        Row: {
          id: string
          caption: string | null
          format: 'image' | 'carousel' | 'reel' | 'story'
          status: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at: string | null
          posted_at: string | null
          platforms: string[]
          notes: string | null
          external_ref: Json | null
          failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          caption?: string | null
          format?: 'image' | 'carousel' | 'reel' | 'story'
          status?: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at?: string | null
          posted_at?: string | null
          platforms?: string[]
          notes?: string | null
          external_ref?: Json | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          caption?: string | null
          format?: 'image' | 'carousel' | 'reel' | 'story'
          status?: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
          scheduled_at?: string | null
          posted_at?: string | null
          platforms?: string[]
          notes?: string | null
          external_ref?: Json | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      social_post_media: {
        Row: {
          id: string
          post_id: string
          url: string
          storage_path: string
          media_type: 'image' | 'video'
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          url: string
          storage_path: string
          media_type?: 'image' | 'video'
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          url?: string
          storage_path?: string
          media_type?: 'image' | 'video'
          position?: number
          created_at?: string
        }
      }
      social_post_products: {
        Row: { post_id: string; product_id: string }
        Insert: { post_id: string; product_id: string }
        Update: { post_id?: string; product_id?: string }
      }
      social_post_retailers: {
        Row: { post_id: string; retailer: string }
        Insert: { post_id: string; retailer: string }
        Update: { post_id?: string; retailer?: string }
      }
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: "No ESLint warnings or errors".

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(social): add social calendar table types"
```

---

### Task 3: Social config + date helpers

**Files:**
- Create: `src/lib/config/social.ts`
- Create: `src/lib/social/dates.ts`

- [ ] **Step 1: Write `src/lib/config/social.ts`**

```typescript
// Display config + validation for the Social Calendar. Chip tones are raw
// class strings (light + dark) passed straight to <Chip tone=...>.

export const SOCIAL_STATUSES = [
  { value: 'idea',      label: 'Idea',      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
  { value: 'draft',     label: 'Draft',     tone: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-400/15 dark:text-zinc-300' },
  { value: 'scheduled', label: 'Scheduled', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300' },
  { value: 'posted',    label: 'Posted',    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' },
  { value: 'failed',    label: 'Failed',    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300' },
] as const

export type SocialStatus = (typeof SOCIAL_STATUSES)[number]['value']
export const SOCIAL_STATUS_VALUES = SOCIAL_STATUSES.map((s) => s.value) as SocialStatus[]

export function statusMeta(status: string) {
  return SOCIAL_STATUSES.find((s) => s.value === status) ?? SOCIAL_STATUSES[0]
}

export const SOCIAL_FORMATS = [
  { value: 'image',    label: 'Single image' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'reel',     label: 'Reel / Video' },
  { value: 'story',    label: 'Story' },
] as const

export type SocialFormat = (typeof SOCIAL_FORMATS)[number]['value']
export const SOCIAL_FORMAT_VALUES = SOCIAL_FORMATS.map((f) => f.value) as SocialFormat[]

export function formatLabel(format: string) {
  return SOCIAL_FORMATS.find((f) => f.value === format)?.label ?? format
}

export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['value']
export const SOCIAL_PLATFORM_VALUES = SOCIAL_PLATFORMS.map((p) => p.value) as SocialPlatform[]

export function isValidPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORM_VALUES as string[]).includes(value)
}
```

- [ ] **Step 2: Write `src/lib/social/dates.ts`**

```typescript
// Date helpers for the calendar. scheduled_at is an ISO timestamp; the app
// displays/groups in America/Detroit (consistent with the price reminders).

const YMD_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Detroit',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 'yyyy-MM-dd' key for an ISO timestamp, in America/Detroit. */
export function detroitYmd(iso: string): string {
  return YMD_FMT.format(new Date(iso))
}

/** 'yyyy-MM-dd' key for a local Date's calendar day (used to key grid cells). */
export function localYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  hour: 'numeric',
  minute: '2-digit',
})

/** e.g. "2:00 PM" in America/Detroit. */
export function detroitTime(iso: string): string {
  return TIME_FMT.format(new Date(iso))
}
```

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/config/social.ts src/lib/social/dates.ts
git commit -m "feat(social): add status/format/platform config + Detroit date helpers"
```

---

### Task 4: Query helpers

**Files:**
- Create: `src/lib/social/queries.ts`

- [ ] **Step 1: Write `src/lib/social/queries.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

// Shape returned to the calendar/queue UIs. Tags are flattened for display.
export interface SocialPostMedia {
  id: string
  url: string
  storage_path: string
  media_type: 'image' | 'video'
  position: number
}

export interface SocialPostRecord {
  id: string
  caption: string | null
  format: 'image' | 'carousel' | 'reel' | 'story'
  status: 'idea' | 'draft' | 'scheduled' | 'posted' | 'failed'
  scheduled_at: string | null
  posted_at: string | null
  platforms: string[]
  notes: string | null
  created_at: string
  updated_at: string
  media: SocialPostMedia[]
  product_ids: string[]
  product_names: string[]
  retailers: string[]
}

const SELECT = `
  id, caption, format, status, scheduled_at, posted_at, platforms, notes, created_at, updated_at,
  social_post_media ( id, url, storage_path, media_type, position ),
  social_post_products ( product_id, products ( name ) ),
  social_post_retailers ( retailer )
`

type RawRow = {
  id: string
  caption: string | null
  format: SocialPostRecord['format']
  status: SocialPostRecord['status']
  scheduled_at: string | null
  posted_at: string | null
  platforms: string[]
  notes: string | null
  created_at: string
  updated_at: string
  social_post_media: SocialPostMedia[] | null
  social_post_products: { product_id: string; products: { name: string } | null }[] | null
  social_post_retailers: { retailer: string }[] | null
}

function shape(row: RawRow): SocialPostRecord {
  const products = row.social_post_products ?? []
  return {
    id: row.id,
    caption: row.caption,
    format: row.format,
    status: row.status,
    scheduled_at: row.scheduled_at,
    posted_at: row.posted_at,
    platforms: row.platforms ?? [],
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    media: (row.social_post_media ?? []).sort((a, b) => a.position - b.position),
    product_ids: products.map((p) => p.product_id),
    product_names: products.map((p) => p.products?.name ?? 'Unknown'),
    retailers: (row.social_post_retailers ?? []).map((r) => r.retailer),
  }
}

/** Posts whose scheduled_at falls within [startIso, endIso). For the calendar. */
export async function getPostsInRange(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string
): Promise<SocialPostRecord[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(SELECT)
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as RawRow[]).map(shape)
}

/** All posts (scheduled + unscheduled ideas). For the queue. */
export async function getAllPosts(supabase: SupabaseClient): Promise<SocialPostRecord[]> {
  const { data, error } = await supabase
    .from('social_posts')
    .select(SELECT)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawRow[]).map(shape)
}

/** Single post for the composer (edit mode). */
export async function getPost(
  supabase: SupabaseClient,
  id: string
): Promise<SocialPostRecord | null> {
  const { data, error } = await supabase.from('social_posts').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? shape(data as unknown as RawRow) : null
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/social/queries.ts
git commit -m "feat(social): add post query helpers (range, all, single)"
```

---

### Task 5: Server actions

**Files:**
- Create: `src/app/actions/social.ts`

- [ ] **Step 1: Write `src/app/actions/social.ts`**

```typescript
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { RETAILERS } from '@/lib/config/retailers'
import { SOCIAL_STATUS_VALUES, SOCIAL_FORMAT_VALUES, isValidPlatform } from '@/lib/config/social'

const BUCKET = 'social-media'

export interface SocialPostInput {
  id?: string
  caption?: string | null
  format: string
  status: string
  scheduled_at?: string | null
  platforms: string[]
  notes?: string | null
  productIds: string[]
  retailers: string[]
  media: { url: string; storage_path: string; media_type: string; position: number }[]
}

function validate(input: SocialPostInput): string | null {
  if (!SOCIAL_FORMAT_VALUES.includes(input.format as never)) return 'Invalid format'
  if (!SOCIAL_STATUS_VALUES.includes(input.status as never)) return 'Invalid status'
  if (!input.platforms.every(isValidPlatform)) return 'Invalid platform'
  if (!input.retailers.every((r) => (RETAILERS as readonly string[]).includes(r))) return 'Invalid retailer'
  if (input.status === 'scheduled' && !input.scheduled_at) return 'Scheduled posts need a date/time'
  return null
}

async function persist(input: SocialPostInput) {
  const supabase = await createSupabaseServerClient()
  const invalid = validate(input)
  if (invalid) return { success: false as const, error: invalid }

  const { data, error } = await supabase.rpc('save_social_post', {
    p_post: {
      id: input.id ?? null,
      caption: input.caption ?? null,
      format: input.format,
      status: input.status,
      scheduled_at: input.scheduled_at ?? null,
      platforms: input.platforms,
      notes: input.notes ?? null,
    },
    p_product_ids: input.productIds,
    p_retailers: input.retailers,
    p_media: input.media,
  })

  if (error) {
    console.error('save_social_post failed:', error)
    return { success: false as const, error: 'Failed to save post' }
  }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const, data: data as string }
}

export async function createSocialPost(input: SocialPostInput) {
  return persist({ ...input, id: undefined })
}

export async function updateSocialPost(id: string, input: SocialPostInput) {
  return persist({ ...input, id })
}

export async function reschedulePost(id: string, scheduledAt: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('social_posts')
    .update({ scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { success: false as const, error: 'Failed to reschedule' }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

export async function updatePostStatus(id: string, status: string) {
  const supabase = await createSupabaseServerClient()
  if (!SOCIAL_STATUS_VALUES.includes(status as never)) return { success: false as const, error: 'Invalid status' }
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'posted') patch.posted_at = new Date().toISOString()
  if (status !== 'posted') patch.posted_at = null
  const { error } = await supabase.from('social_posts').update(patch).eq('id', id)
  if (error) return { success: false as const, error: 'Failed to update status' }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

export async function deleteSocialPost(id: string) {
  const supabase = await createSupabaseServerClient()
  const { data: media } = await supabase.from('social_post_media').select('storage_path').eq('post_id', id)
  const paths = (media ?? []).map((m) => m.storage_path).filter(Boolean)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('social_posts').delete().eq('id', id)
  if (error) return { success: false as const, error: 'Failed to delete post' }
  revalidatePath('/dashboard/social')
  revalidatePath('/dashboard/social/queue')
  return { success: true as const }
}

/** Server-side image upload (<=5MB, enforced by the server-action body limit). */
export async function uploadSocialImage(formData: FormData) {
  const supabase = await createSupabaseServerClient()
  const file = formData.get('file') as File | null
  if (!file) return { success: false as const, error: 'No file' }
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) return { success: false as const, error: 'Upload failed' }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { success: true as const, data: { url: publicUrl, storage_path: path, media_type: 'image' as const } }
}

/** Signed URL for direct-to-storage video upload (bypasses the 5MB body limit). */
export async function createSocialVideoUploadUrl(filename: string) {
  const supabase = await createSupabaseServerClient()
  const ext = filename.split('.').pop() || 'mp4'
  const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false as const, error: 'Could not create upload URL' }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { success: true as const, data: { token: data.token, path: data.path, url: publicUrl } }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: clean. (If lint flags the `as never` casts, they are intentional for the `includes` narrowing; leave them.)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/social.ts
git commit -m "feat(social): add post CRUD/status/reschedule + media upload actions"
```

---

### Task 6: Navigation entry

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx` (the `NAV` array, ~lines 26-33; imports ~9-24)
- Modify: `src/components/layout/main-nav.tsx` (its nav list — used by the mobile sheet)

- [ ] **Step 1: Add `CalendarDays` to the sidebar imports**

In `src/components/layout/app-sidebar.tsx`, add `CalendarDays` to the `lucide-react` import block:

```typescript
import {
  LayoutDashboard,
  Package,
  Tags,
  GitCompareArrows,
  LineChart,
  CalendarDays,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
```

- [ ] **Step 2: Add the Social entry to `NAV`**

Insert it after the Analytics entry, before Settings:

```typescript
  { title: "Analytics", href: "/dashboard/analytics", icon: LineChart, match: ["/dashboard/analytics"] },
  { title: "Social", href: "/dashboard/social", icon: CalendarDays, match: ["/dashboard/social"] },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, match: ["/dashboard/settings"] },
```

- [ ] **Step 3: Mirror it in `main-nav.tsx`**

Open `src/components/layout/main-nav.tsx`, find its nav-items array (same shape: title/href/icon), import `CalendarDays` from `lucide-react`, and add the same `{ title: "Social", href: "/dashboard/social", icon: CalendarDays }` entry after Analytics. Match the existing item formatting in that file exactly.

- [ ] **Step 4: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/main-nav.tsx
git commit -m "feat(social): add Social nav entry to sidebar + mobile nav"
```

---

### Task 7: Status chip + post tile components

**Files:**
- Create: `src/components/social/status-chip.tsx`
- Create: `src/components/social/post-tile.tsx`

- [ ] **Step 1: Write `src/components/social/status-chip.tsx`**

```tsx
import { Chip } from '@/components/ui/chip'
import { statusMeta } from '@/lib/config/social'

export function StatusChip({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const meta = statusMeta(status)
  return <Chip label={meta.label} tone={meta.tone} size={size} />
}
```

- [ ] **Step 2: Write `src/components/social/post-tile.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { Film, ImageIcon, Images, Square } from 'lucide-react'
import { statusMeta, type SocialFormat } from '@/lib/config/social'
import { detroitTime } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'

const FORMAT_ICON: Record<SocialFormat, typeof Film> = {
  image: ImageIcon,
  carousel: Images,
  reel: Film,
  story: Square,
}

// A single post rendered as a thumbnail tile inside a calendar day cell.
export function PostTile({
  post,
  onClick,
  onDragStart,
}: {
  post: SocialPostRecord
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const meta = statusMeta(post.status)
  const Icon = FORMAT_ICON[post.format]
  const thumb = post.media[0]
  const time = post.scheduled_at ? detroitTime(post.scheduled_at) : null

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group mb-1 flex w-full items-center gap-1.5 rounded-md border border-border bg-card p-1 text-left transition-colors hover:bg-accent"
      style={{ borderLeft: `3px solid` }}
      data-status={post.status}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded ${meta.tone}`}>
        {thumb && thumb.media_type === 'image' ? (
          <Image src={thumb.url} alt="" width={28} height={28} className="size-7 object-cover" />
        ) : (
          <Icon className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-foreground">
          {post.caption?.trim() || 'Untitled post'}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {post.platforms.map((p) => (p === 'instagram' ? 'IG' : 'FB')).join(' · ')}
          {time ? ` · ${time}` : ''}
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/status-chip.tsx src/components/social/post-tile.tsx
git commit -m "feat(social): add status chip + calendar post tile"
```

---

### Task 8: Calendar page + month grid (integration milestone)

**Files:**
- Create: `src/app/(dashboard)/dashboard/social/page.tsx`
- Create: `src/components/social/social-calendar.tsx`

This task renders the calendar end-to-end. The composer is wired in Task 12; for now, clicking a day/post calls a placeholder `onOpen` that we replace later.

- [ ] **Step 1: Write the calendar page `src/app/(dashboard)/dashboard/social/page.tsx`**

```tsx
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { ListChecks } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPostsInRange } from '@/lib/social/queries'
import { SocialCalendar } from '@/components/social/social-calendar'

export const metadata = { title: 'Social' }
export const dynamic = 'force-dynamic'

// month param is 'yyyy-MM'; defaults to the current month.
function monthBounds(month: string | undefined): { year: number; monthIndex: number; startIso: string; endIso: string } {
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth()
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    year = y
    monthIndex = m - 1
  }
  // Pad by a week each side so trailing/leading days of adjacent months show their posts.
  const start = new Date(year, monthIndex, 1)
  start.setDate(start.getDate() - 7)
  const end = new Date(year, monthIndex + 1, 1)
  end.setDate(end.getDate() + 7)
  return { year, monthIndex, startIso: start.toISOString(), endIso: end.toISOString() }
}

export default async function SocialCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const { year, monthIndex, startIso, endIso } = monthBounds(month)
  const supabase = await createSupabaseServerClient()
  const posts = await getPostsInRange(supabase, startIso, endIso)

  return (
    <PageContainer>
      <PageHeader
        title="Social"
        actions={
          <IconButton href="/dashboard/social/queue" label="Queue" icon={ListChecks} />
        }
      />
      <div className="mt-6">
        <SocialCalendar year={year} monthIndex={monthIndex} posts={posts} />
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 2: Write `src/components/social/social-calendar.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostTile } from './post-tile'
import { reschedulePost } from '@/app/actions/social'
import { detroitYmd, localYmd } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function SocialCalendar({
  year,
  monthIndex,
  posts,
  onOpen,
}: {
  year: number
  monthIndex: number
  posts: SocialPostRecord[]
  onOpen?: (arg: { postId?: string; date?: string }) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const monthDate = new Date(year, monthIndex, 1)

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Group scheduled posts by Detroit calendar day.
  const byDay = new Map<string, SocialPostRecord[]>()
  for (const p of posts) {
    if (!p.scheduled_at) continue
    const key = detroitYmd(p.scheduled_at)
    const arr = byDay.get(key) ?? []
    arr.push(p)
    byDay.set(key, arr)
  }

  function goMonth(delta: number) {
    const d = addMonths(monthDate, delta)
    router.push(`/dashboard/social?month=${format(d, 'yyyy-MM')}`)
  }

  async function handleDrop(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    const postId = e.dataTransfer.getData('text/plain')
    if (!postId) return
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    // Preserve time-of-day; swap the date. Fall back to noon if unscheduled.
    const prev = post.scheduled_at ? new Date(post.scheduled_at) : new Date()
    const [y, m, d] = dayKey.split('-').map(Number)
    const next = new Date(prev)
    next.setFullYear(y, m - 1, d)
    if (!post.scheduled_at) next.setHours(12, 0, 0, 0)
    setPending(true)
    await reschedulePost(postId, next.toISOString())
    setPending(false)
    router.refresh()
  }

  return (
    <div aria-busy={pending}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{format(monthDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/social')}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const key = localYmd(day)
          const dayPosts = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, monthDate)
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, key)}
              onClick={() => onOpen?.({ date: key })}
              className={[
                'min-h-[104px] rounded-lg border p-1.5 transition-colors',
                inMonth ? 'bg-card border-border' : 'bg-muted/40 border-transparent',
                isToday(day) ? 'ring-1 ring-brand border-brand' : '',
                'hover:border-brand/50 cursor-pointer',
              ].join(' ')}
            >
              <div className={`mb-1 text-xs font-semibold ${inMonth ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              {dayPosts.map((p) => (
                <PostTile
                  key={p.id}
                  post={p}
                  onClick={() => onOpen?.({ postId: p.id })}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

> Note: `PostTile`'s click is wrapped so the day's `onClick` doesn't also fire — add `onClick={(e) => { e.stopPropagation(); onOpen?.({ postId: p.id }) }}` if propagation causes a double-open during manual testing. (The tile is a `<button>`, so the click handler on it should be the one to stop propagation; adjust in Task 12 when wiring real open logic.)

- [ ] **Step 3: Verify the IconButton API**

Run: `grep -n "label\|icon\|href" src/components/ui/icon-button.tsx | head`
Expected: confirms `IconButton` accepts `label`, `icon`, and `href` props. If the prop names differ (e.g. `Icon` vs `icon`), adjust the page's `<IconButton .../>` usage to match before continuing.

- [ ] **Step 4: Verify build passes**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds. The `/dashboard/social` route appears in the build output.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/social/page.tsx" src/components/social/social-calendar.tsx
git commit -m "feat(social): month calendar page + grid with drag-to-reschedule"
```

---

### Task 9: Tag picker

**Files:**
- Create: `src/components/social/tag-picker.tsx`

Reuses the existing `Select` for retailers and a simple checkbox list for products (mirrors how products are chosen elsewhere). Both render selections as `Chip`s.

- [ ] **Step 1: Write `src/components/social/tag-picker.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Chip } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, X } from 'lucide-react'
import { RETAILERS } from '@/lib/config/retailers'

export interface ProductOption { id: string; name: string }

export function TagPicker({
  products,
  selectedProductIds,
  onProductsChange,
  selectedRetailers,
  onRetailersChange,
}: {
  products: ProductOption[]
  selectedProductIds: string[]
  onProductsChange: (ids: string[]) => void
  selectedRetailers: string[]
  onRetailersChange: (retailers: string[]) => void
}) {
  const [q, setQ] = useState('')
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  function toggleProduct(id: string) {
    onProductsChange(
      selectedProductIds.includes(id)
        ? selectedProductIds.filter((x) => x !== id)
        : [...selectedProductIds, id]
    )
  }
  function toggleRetailer(r: string) {
    onRetailersChange(
      selectedRetailers.includes(r)
        ? selectedRetailers.filter((x) => x !== r)
        : [...selectedRetailers, r]
    )
  }

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? 'Unknown'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedProductIds.map((id) => (
          <Chip
            key={id}
            tone="auto"
            colorKey={id}
            label={
              <span className="flex items-center gap-1">
                {nameOf(id)}
                <X className="size-3 cursor-pointer" onClick={() => toggleProduct(id)} />
              </span>
            }
          />
        ))}
        {selectedRetailers.map((r) => (
          <Chip
            key={r}
            tone="brand"
            label={
              <span className="flex items-center gap-1">
                {r}
                <X className="size-3 cursor-pointer" onClick={() => toggleRetailer(r)} />
              </span>
            }
          />
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <Plus className="size-3" /> Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input
              placeholder="Search products…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-2 h-8"
            />
            <div className="max-h-44 space-y-0.5 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                    selectedProductIds.includes(p.id) ? 'font-medium text-brand' : ''
                  }`}
                >
                  {p.name}
                  {selectedProductIds.includes(p.id) && <span>✓</span>}
                </button>
              ))}
              {filtered.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No products</p>}
            </div>
            <div className="mt-2 border-t pt-2">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase text-muted-foreground">Retailers</p>
              <div className="flex flex-wrap gap-1">
                {RETAILERS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => toggleRetailer(r)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      selectedRetailers.includes(r) ? 'border-brand bg-brand-muted text-brand' : 'border-border'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Confirm a Popover component exists**

Run: `ls src/components/ui/popover.tsx`
Expected: file exists (Radix popover is a dependency). If missing, create it via the shadcn pattern used by the other `ui/*` Radix wrappers (e.g. `select.tsx`) before continuing.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/tag-picker.tsx
git commit -m "feat(social): add product/retailer tag picker"
```

---

### Task 10: Media dropzone

**Files:**
- Create: `src/components/social/media-dropzone.tsx`

- [ ] **Step 1: Write `src/components/social/media-dropzone.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, X } from 'lucide-react'
import { uploadSocialImage, createSocialVideoUploadUrl } from '@/app/actions/social'
import { createClientClient } from '@/lib/supabase/client'

export interface MediaItem { url: string; storage_path: string; media_type: 'image' | 'video'; position: number }

const BUCKET = 'social-media'

export function MediaDropzone({
  media,
  onChange,
}: {
  media: MediaItem[]
  onChange: (m: MediaItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    const next = [...media]
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('video/')) {
          // Direct-to-storage to bypass the 5MB server-action limit.
          const signed = await createSocialVideoUploadUrl(file.name)
          if (!signed.success) throw new Error(signed.error)
          const supabase = createClientClient()
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(signed.data.path, signed.data.token, file)
          if (upErr) throw upErr
          next.push({ url: signed.data.url, storage_path: signed.data.path, media_type: 'video', position: next.length })
        } else {
          const fd = new FormData()
          fd.append('file', file)
          const res = await uploadSocialImage(fd)
          if (!res.success) throw new Error(res.error)
          next.push({ ...res.data, position: next.length })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      }
    }
    onChange(next.map((m, i) => ({ ...m, position: i })))
    setBusy(false)
  }

  function remove(idx: number) {
    onChange(media.filter((_, i) => i !== idx).map((m, i) => ({ ...m, position: i })))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {media.map((m, i) => (
          <div key={m.storage_path} className="relative size-16 overflow-hidden rounded-md border border-border bg-muted">
            {m.media_type === 'image' ? (
              <Image src={m.url} alt="" width={64} height={64} className="size-16 object-cover" />
            ) : (
              <video src={m.url} className="size-16 object-cover" />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
              aria-label="Remove media"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-brand/60 hover:text-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? 'Uploading…' : 'Add images or video'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Confirm the browser client export name**

Run: `grep -n "export" src/lib/supabase/client.ts`
Expected: confirms the factory is `createClientClient`. If it's named differently, update the import in this file to match.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/media-dropzone.tsx
git commit -m "feat(social): add media dropzone (image upload + direct-to-storage video)"
```

---

### Task 11: Live post preview

**Files:**
- Create: `src/components/social/post-preview.tsx`

- [ ] **Step 1: Write `src/components/social/post-preview.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { Instagram, Facebook } from 'lucide-react'
import type { MediaItem } from './media-dropzone'

// Phone-style preview of the post as it would appear on IG/FB.
export function PostPreview({
  caption,
  media,
  platforms,
}: {
  caption: string
  media: MediaItem[]
  platforms: string[]
}) {
  const first = media[0]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {platforms.includes('instagram') && <Instagram className="size-4" />}
        {platforms.includes('facebook') && <Facebook className="size-4" />}
        <span>Preview</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <div className="size-6 rounded-full bg-brand" />
          <span className="text-xs font-semibold">wahlburgers</span>
        </div>
        <div className="flex aspect-square items-center justify-center bg-muted">
          {first ? (
            first.media_type === 'image' ? (
              <Image src={first.url} alt="" width={320} height={320} className="size-full object-cover" />
            ) : (
              <video src={first.url} className="size-full object-cover" controls />
            )
          ) : (
            <span className="text-xs text-muted-foreground">No media yet</span>
          )}
        </div>
        <div className="p-2 text-xs text-foreground">
          <span className="font-semibold">wahlburgers</span>{' '}
          <span className="text-muted-foreground">{caption || 'Your caption will appear here…'}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/social/post-preview.tsx
git commit -m "feat(social): add live post preview pane"
```

---

### Task 12: Composer dialog + wire into calendar

**Files:**
- Create: `src/components/social/post-composer-dialog.tsx`
- Create: `src/components/social/social-board.tsx` (client wrapper that owns composer state)
- Modify: `src/app/(dashboard)/dashboard/social/page.tsx` (fetch products; render `SocialBoard` instead of `SocialCalendar` directly)

- [ ] **Step 1: Write `src/components/social/post-composer-dialog.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Trash2 } from 'lucide-react'
import { SOCIAL_FORMATS, SOCIAL_STATUSES, SOCIAL_PLATFORMS } from '@/lib/config/social'
import { TagPicker, type ProductOption } from './tag-picker'
import { MediaDropzone, type MediaItem } from './media-dropzone'
import { PostPreview } from './post-preview'
import { createSocialPost, updateSocialPost, deleteSocialPost } from '@/app/actions/social'
import type { SocialPostRecord } from '@/lib/social/queries'

// Converts an ISO timestamp to the value a datetime-local input expects (local wall clock).
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PostComposerDialog({
  open,
  onOpenChange,
  products,
  post,
  initialDate,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: ProductOption[]
  post?: SocialPostRecord | null
  initialDate?: string // 'yyyy-MM-dd'
  onSaved: () => void
}) {
  const [caption, setCaption] = useState('')
  const [format, setFormat] = useState<string>('image')
  const [status, setStatus] = useState<string>('idea')
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [when, setWhen] = useState<string>('')
  const [productIds, setProductIds] = useState<string[]>([])
  const [retailers, setRetailers] = useState<string[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate when opening.
  useEffect(() => {
    if (!open) return
    if (post) {
      setCaption(post.caption ?? '')
      setFormat(post.format)
      setStatus(post.status)
      setPlatforms(post.platforms.length ? post.platforms : ['instagram', 'facebook'])
      setWhen(toLocalInput(post.scheduled_at))
      setProductIds(post.product_ids)
      setRetailers(post.retailers)
      setMedia(post.media.map((m) => ({ url: m.url, storage_path: m.storage_path, media_type: m.media_type, position: m.position })))
    } else {
      setCaption('')
      setFormat('image')
      setStatus('idea')
      setPlatforms(['instagram', 'facebook'])
      setWhen(initialDate ? `${initialDate}T12:00` : '')
      setProductIds([])
      setRetailers([])
      setMedia([])
    }
    setError(null)
  }, [open, post, initialDate])

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const input = {
      caption,
      format,
      status,
      scheduled_at: when ? new Date(when).toISOString() : null,
      platforms,
      productIds,
      retailers,
      media,
    }
    const res = post ? await updateSocialPost(post.id, input) : await createSocialPost(input)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to save')
      return
    }
    onOpenChange(false)
    onSaved()
  }

  async function handleDelete() {
    if (!post) return
    setSaving(true)
    await deleteSocialPost(post.id)
    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit post' : 'New post'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          {/* Fields */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="caption">Caption</Label>
              <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOCIAL_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOCIAL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Media</Label>
              <MediaDropzone media={media} onChange={setMedia} />
            </div>

            <div>
              <Label>Publish to</Label>
              <div className="flex gap-2">
                {SOCIAL_PLATFORMS.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      platforms.includes(p.value) ? 'border-brand bg-brand-muted text-brand font-medium' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="when">When</Label>
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>

            <div>
              <Label>Tags</Label>
              <TagPicker
                products={products}
                selectedProductIds={productIds}
                onProductsChange={setProductIds}
                selectedRetailers={retailers}
                onRetailersChange={setRetailers}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Live preview */}
          <PostPreview caption={caption} media={media} platforms={platforms} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {post && (
              <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive">
                <Trash2 className="mr-1 size-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              {status === 'scheduled' ? 'Schedule' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Write `src/components/social/social-board.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SocialCalendar } from './social-calendar'
import { PostComposerDialog } from './post-composer-dialog'
import type { ProductOption } from './tag-picker'
import type { SocialPostRecord } from '@/lib/social/queries'

// Owns composer open/close + which post is being edited, around the calendar.
export function SocialBoard({
  year,
  monthIndex,
  posts,
  products,
}: {
  year: number
  monthIndex: number
  posts: SocialPostRecord[]
  products: ProductOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SocialPostRecord | null>(null)
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined)

  function openFor({ postId, date }: { postId?: string; date?: string }) {
    if (postId) {
      setEditing(posts.find((p) => p.id === postId) ?? null)
      setInitialDate(undefined)
    } else {
      setEditing(null)
      setInitialDate(date)
    }
    setOpen(true)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => openFor({ date: undefined })}>
          <Plus className="mr-1 size-4" /> New post
        </Button>
      </div>
      <SocialCalendar year={year} monthIndex={monthIndex} posts={posts} onOpen={openFor} />
      <PostComposerDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        post={editing}
        initialDate={initialDate}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update the calendar page to fetch products and render `SocialBoard`**

Replace the import and body of `src/app/(dashboard)/dashboard/social/page.tsx` so it loads products and renders the board:

```tsx
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { ListChecks } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPostsInRange } from '@/lib/social/queries'
import { SocialBoard } from '@/components/social/social-board'

export const metadata = { title: 'Social' }
export const dynamic = 'force-dynamic'

function monthBounds(month: string | undefined) {
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth()
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    year = y
    monthIndex = m - 1
  }
  const start = new Date(year, monthIndex, 1)
  start.setDate(start.getDate() - 7)
  const end = new Date(year, monthIndex + 1, 1)
  end.setDate(end.getDate() + 7)
  return { year, monthIndex, startIso: start.toISOString(), endIso: end.toISOString() }
}

export default async function SocialCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const { year, monthIndex, startIso, endIso } = monthBounds(month)
  const supabase = await createSupabaseServerClient()
  const [posts, productsRes] = await Promise.all([
    getPostsInRange(supabase, startIso, endIso),
    supabase.from('products').select('id, name').order('name'),
  ])
  const products = (productsRes.data ?? []) as { id: string; name: string }[]

  return (
    <PageContainer>
      <PageHeader
        title="Social"
        actions={<IconButton href="/dashboard/social/queue" label="Queue" icon={ListChecks} />}
      />
      <div className="mt-6">
        <SocialBoard year={year} monthIndex={monthIndex} posts={posts} products={products} />
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 4: Fix tile click propagation in `social-calendar.tsx`**

In `PostTile`'s `onClick` inside `social-calendar.tsx`, stop propagation so opening a post doesn't also trigger the day's create handler:

```tsx
                <PostTile
                  key={p.id}
                  post={p}
                  onClick={() => onOpen?.({ postId: p.id })}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                />
```

In `post-tile.tsx`, change the button's handler to stop propagation:

```tsx
      onClick={(e) => { e.stopPropagation(); onClick() }}
```

(Adjust the `PostTile` prop type if needed — `onClick: () => void` stays; only the internal handler wraps it.)

- [ ] **Step 5: Confirm Dialog sub-exports**

Run: `grep -n "export" src/components/ui/dialog.tsx`
Expected: includes `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`. If `DialogFooter` is absent, replace it in the composer with a `<div className="mt-4 flex items-center justify-between">`.

- [ ] **Step 6: Verify build passes**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/social/post-composer-dialog.tsx src/components/social/social-board.tsx "src/app/(dashboard)/dashboard/social/page.tsx" src/components/social/post-tile.tsx src/components/social/social-calendar.tsx
git commit -m "feat(social): two-pane composer dialog wired into the calendar"
```

---

### Task 13: Queue page + list (integration milestone)

**Files:**
- Create: `src/app/(dashboard)/dashboard/social/queue/page.tsx`
- Create: `src/components/social/queue-list.tsx`

- [ ] **Step 1: Write `src/components/social/queue-list.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Chip } from '@/components/ui/chip'
import { StatusChip } from './status-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowActions } from '@/components/ui/row-actions'
import { PostComposerDialog } from './post-composer-dialog'
import { deleteSocialPost } from '@/app/actions/social'
import { SOCIAL_STATUSES, formatLabel } from '@/lib/config/social'
import { detroitTime, detroitYmd } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'
import type { ProductOption } from './tag-picker'

export function QueueList({ posts, products }: { posts: SocialPostRecord[]; products: ProductOption[] }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editing, setEditing] = useState<SocialPostRecord | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(
    () => (statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter)),
    [posts, statusFilter]
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SOCIAL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No posts.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => { setEditing(p); setOpen(true) }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <StatusChip status={p.status} />
                <span className="truncate text-sm font-medium">{p.caption?.trim() || 'Untitled post'}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{formatLabel(p.format)}</span>
                <span>·</span>
                <span>{p.scheduled_at ? `${detroitYmd(p.scheduled_at)} ${detroitTime(p.scheduled_at)}` : 'Unscheduled'}</span>
                {p.product_names.map((n, i) => <Chip key={`${p.id}-pn-${i}`} label={n} tone="auto" colorKey={p.product_ids[i]} size="sm" />)}
                {p.retailers.map((r) => <Chip key={`${p.id}-r-${r}`} label={r} tone="brand" size="sm" />)}
              </div>
            </button>
            <RowActions
              actions={[
                { label: 'Edit', onClick: () => { setEditing(p); setOpen(true) } },
                { label: 'Delete', destructive: true, onClick: async () => { await deleteSocialPost(p.id); router.refresh() } },
              ]}
            />
          </div>
        ))}
      </div>

      <PostComposerDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        post={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
```

- [ ] **Step 2: Confirm the `RowActions` API**

Run: `sed -n '1,60p' src/components/ui/row-actions.tsx`
Expected: confirms the prop shape (an `actions` array of `{ label, onClick, destructive? }`, or similar). **Adjust the `<RowActions .../>` usage in Step 1 to match the real prop names** (e.g. it may take `items` or render `Edit`/`Delete` differently). This is the one component whose API must be matched exactly.

- [ ] **Step 3: Write the queue page `src/app/(dashboard)/dashboard/social/queue/page.tsx`**

```tsx
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAllPosts } from '@/lib/social/queries'
import { QueueList } from '@/components/social/queue-list'

export const metadata = { title: 'Queue' }
export const dynamic = 'force-dynamic'

export default async function SocialQueuePage() {
  const supabase = await createSupabaseServerClient()
  const [posts, productsRes] = await Promise.all([
    getAllPosts(supabase),
    supabase.from('products').select('id, name').order('name'),
  ])
  const products = (productsRes.data ?? []) as { id: string; name: string }[]

  return (
    <PageContainer>
      <PageHeader
        title="Queue"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Queue' }]}
      />
      <div className="mt-6">
        <QueueList posts={posts} products={products} />
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 4: Verify build passes**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds; `/dashboard/social/queue` in the output.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/social/queue/page.tsx" src/components/social/queue-list.tsx
git commit -m "feat(social): queue list page with status filter + row actions"
```

---

### Task 14: Reminders — daily social digest

**Files:**
- Modify: `src/lib/email/settings.ts` (extend `ReminderSettings` + defaults + `normalizeSettings`)
- Modify: `src/lib/email/reminder-data.ts` (add `getUpcomingAndOverduePosts`)
- Create: `src/lib/email/send-social-reminder.ts`
- Modify: `src/app/api/cron/price-reminder/route.ts` (separate daily social block)
- Modify: `src/app/actions/reminders.ts` (persist the new settings fields)
- Modify: `src/app/(dashboard)/dashboard/prices/reminders/page.tsx` (Social settings section)

- [ ] **Step 1: Extend `src/lib/email/settings.ts`**

Add the two fields to the interface, defaults, and normalizer:

```typescript
export interface ReminderSettings {
  weekly_day: number
  weekly_hour: number
  recipients: string[]
  followup_enabled: boolean
  followup_days_after: number
  stale_threshold_days: number
  na_digest_enabled: boolean
  na_recipients: string[]
  social_reminder_enabled: boolean
  social_recipients: string[]
}
```

In `DEFAULT_REMINDER_SETTINGS` add:

```typescript
  social_reminder_enabled: true,
  social_recipients: ["info@kullenjahnke.com", "rjahnke@arkkfood.com"],
```

In `normalizeSettings`'s returned object add:

```typescript
    social_reminder_enabled: row.social_reminder_enabled ?? DEFAULT_REMINDER_SETTINGS.social_reminder_enabled,
    social_recipients: row.social_recipients?.length ? row.social_recipients : DEFAULT_REMINDER_SETTINGS.social_recipients,
```

- [ ] **Step 2: Add the query to `src/lib/email/reminder-data.ts`**

Append this export (it reuses the file's existing `SupabaseClient` import):

```typescript
export interface SocialPostReminderEntry {
  caption: string
  when: string
  overdue: boolean
}

// Posts scheduled for "today" (America/Detroit) plus any still-'scheduled'
// post whose time has already passed (overdue). For the daily social digest.
export async function getUpcomingAndOverduePosts(
  admin: SupabaseClient
): Promise<SocialPostReminderEntry[]> {
  const nowMs = Date.now()
  const todayYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const { data, error } = await admin
    .from('social_posts')
    .select('caption, scheduled_at, status')
    .in('status', ['scheduled'])
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
  if (error) throw error

  const fmtDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const fmtTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', hour: 'numeric', minute: '2-digit',
  })

  const out: SocialPostReminderEntry[] = []
  for (const row of (data ?? []) as { caption: string | null; scheduled_at: string; status: string }[]) {
    const t = new Date(row.scheduled_at)
    const isToday = fmtDay.format(t) === todayYmd
    const overdue = t.getTime() < nowMs && !isToday
    if (isToday || overdue) {
      out.push({
        caption: row.caption?.trim() || 'Untitled post',
        when: `${fmtDay.format(t)} ${fmtTime.format(t)}`,
        overdue,
      })
    }
  }
  return out
}
```

- [ ] **Step 3: Write `src/lib/email/send-social-reminder.ts`**

```typescript
import { getResend } from "./resend"
import { EMAIL_FROM } from "./config"
import { emailShell, emailList } from "./shell"
import type { SocialPostReminderEntry } from "./reminder-data"

const SOCIAL_URL = "https://wahlburgers-price-tracker.vercel.app/dashboard/social"

export function buildSocialReminderEmail(items: SocialPostReminderEntry[], opts?: { test?: boolean }) {
  const prefix = opts?.test ? "[Test] " : ""
  const overdue = items.filter((i) => i.overdue).length
  const subject = `${prefix}${items.length} social post${items.length === 1 ? "" : "s"} to handle today${overdue ? ` (${overdue} overdue)` : ""}`
  const intro = "Here are the social posts scheduled for today, plus any that are past due and still not marked posted."

  const html = emailShell({
    heading: "Social posts for today",
    intro,
    bodyHtml: emailList(items.map((i) => ({ label: i.caption, sub: i.overdue ? `OVERDUE · ${i.when}` : i.when }))),
    ctaLabel: "Open Social Calendar",
    ctaUrl: SOCIAL_URL,
    footer: "Automated social reminder from WahlTools.",
  })

  const text = [
    "Social posts for today:",
    "",
    ...items.map((i) => `- ${i.caption} — ${i.overdue ? `OVERDUE (${i.when})` : i.when}`),
    "",
    `Open the calendar: ${SOCIAL_URL}`,
    "",
    "— WahlTools",
  ].join("\n")

  return { subject, html, text }
}

export async function sendSocialReminder(
  to: string[],
  items: SocialPostReminderEntry[],
  opts?: { test?: boolean }
): Promise<{ id: string }> {
  const resend = getResend()
  const { subject, html, text } = buildSocialReminderEmail(items, opts)
  const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message ?? String(error)}`)
  return { id: data?.id ?? "" }
}
```

- [ ] **Step 4: Add the separated daily social block to the cron route**

In `src/app/api/cron/price-reminder/route.ts`, add the imports:

```typescript
import { getUpcomingAndOverduePosts } from "@/lib/email/reminder-data"
import { sendSocialReminder } from "@/lib/email/send-social-reminder"
```

Then, **after** the existing `try { … } catch` block that handles the weekday-gated price/follow-up/N-A sends (and before `return NextResponse.json(...)`), add a **separate** block so its failures never affect the price reminders and it runs **every day**:

```typescript
  // Social digest — independent of the weekday gating; runs daily (morning-of).
  try {
    if (settings.social_reminder_enabled) {
      const socialPosts = await getUpcomingAndOverduePosts(admin)
      if (socialPosts.length > 0) {
        const r = await sendSocialReminder(settings.social_recipients, socialPosts)
        actions.social = { id: r.id, count: socialPosts.length }
      }
    }
  } catch (error) {
    console.error("social reminder send failed:", error)
    // Do not fail the whole cron on a social-digest error.
    actions.socialError = true
  }
```

- [ ] **Step 5: Persist the new fields in the reminders save action**

Open `src/app/actions/reminders.ts`. In `saveReminderSettings` (the function that writes `reminder_settings`), include the two new columns in the update/upsert payload, reading them from the incoming settings object exactly like the existing fields:

```typescript
      social_reminder_enabled: settings.social_reminder_enabled,
      social_recipients: settings.social_recipients,
```

(Match the existing payload's style — if it spreads a typed object, ensure the type now includes these via the updated `ReminderSettings`.)

- [ ] **Step 6: Add a Social section to the Reminders settings page**

In `src/app/(dashboard)/dashboard/prices/reminders/page.tsx` (or its client form component if the form is split out), add a section mirroring the existing N/A digest section: a `Switch` bound to `social_reminder_enabled` and an email `Input`/`Textarea` bound to `social_recipients` (use the existing `parseEmails`/`formatEmails` helpers). Follow the exact markup/labels pattern of the adjacent "N/A digest" block so styling and light/dark stay consistent.

- [ ] **Step 7: Verify build passes**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/email/settings.ts src/lib/email/reminder-data.ts src/lib/email/send-social-reminder.ts src/app/api/cron/price-reminder/route.ts src/app/actions/reminders.ts "src/app/(dashboard)/dashboard/prices/reminders/page.tsx"
git commit -m "feat(social): daily social digest (separate cron block) + reminder settings"
```

---

### Task 15: Final verification & manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Full build**

Run: `pnpm lint && pnpm build`
Expected: lint clean; build succeeds; `/dashboard/social` and `/dashboard/social/queue` both listed.

- [ ] **Step 2: Confirm migrations are applied**

In the Supabase SQL editor, confirm `social_posts`, `social_post_media`, `social_post_products`, `social_post_retailers` exist, the `social-media` bucket exists, and `reminder_settings` has the two new columns. (Re-run Task 1's files if not.)

- [ ] **Step 3: Manual smoke via the preview tools**

Start the dev server and verify in the browser preview:
1. Sidebar shows **Social**; navigating to `/dashboard/social` renders the month grid (current month, today ringed).
2. Click **New post** → composer opens → type a caption, choose Carousel, upload 2 images, toggle IG only, set status **Scheduled** with a date this month, tag a product + a retailer → **Schedule**. Dialog closes; tile appears on that day with the thumbnail.
3. Drag the tile to another day → it moves; reload → it stays (reschedule persisted).
4. Open the tile → change status to **Posted** → save → status chip updates.
5. Create an **Idea** with no date → it does **not** appear on the calendar but **does** appear in `/dashboard/social/queue`.
6. Queue: filter by status; Edit + Delete via the row kebab work.
7. Toggle dark mode → calendar, tiles, composer, queue all render correctly.

- [ ] **Step 4: Verify the social digest renders (no real send)**

Run a quick check that `buildSocialReminderEmail` produces valid HTML for a sample list (either via the existing reminders "test send" path if it can be pointed at the social builder, or by temporarily logging the output of `buildSocialReminderEmail([{caption:'X',when:'2026-06-08 2:00 PM',overdue:false}])` in a scratch route). Remove any scratch code before finishing.

- [ ] **Step 5: Final commit (if any smoke fixes were needed)**

```bash
git add -A
git commit -m "fix(social): address manual smoke findings"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §2 calendar Month-only, thumbnail tiles, drag/click → Tasks 7, 8, 12. Statuses → Task 3. Composer two-pane + preview → Tasks 10–12. IG/FB toggles → Task 12. Many products + many retailers → Tasks 1, 9, 12. Ideas-only-in-queue → Tasks 8 (grid skips null `scheduled_at` is implicit; queue shows all via `getAllPosts`) + 13. Reminders morning-of+overdue → Task 14. Media image+video → Tasks 5, 10. Calendar+Queue surfaces → Tasks 8, 13. Light/dark → every component task + Task 15 step 3.7.
- §3 schema (3 join tables + RPC + platform CHECK) → Task 1; types → Task 2.
- §4 server actions (all six) → Task 5.
- §5 routes/components/config/nav → Tasks 3, 6, 7–13.
- §6 reminders (data + template + separated cron + settings UI) → Task 14.
- §7 types + numbered migrations → Tasks 1, 2.

**Placeholder scan:** No "TBD/TODO". The three spots that say "match the existing pattern / adjust to the real prop names" (Task 6 main-nav, Task 13 `RowActions`, Task 14 reminders form) are deliberate because those components' exact APIs must be read at execution time; each includes the exact `grep`/`sed` command to discover the API and what to do with it. These are verification-gated, not vague.

**Type consistency:** `SocialPostInput` (Task 5) matches the composer's `input` object (Task 12) field-for-field. `SocialPostRecord`/`MediaItem` (Tasks 4, 10) are used consistently across tile/preview/composer/queue. `save_social_post`'s four params (Task 1) match the `.rpc('save_social_post', { p_post, p_product_ids, p_retailers, p_media })` call (Task 5). `statusMeta`/`formatLabel`/`detroitYmd`/`detroitTime` names are consistent between definition (Task 3) and use (Tasks 7, 8, 13).
