# Social Calendar — Feature A: AI Caption Generation (+ Phase 3 groundwork) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared `social_settings` singleton (Phase 3 groundwork) and an AI "Generate caption" affordance in the post composer that drafts an on-brand caption from a post idea via Claude.

**Architecture:** A new `social_settings` singleton table (mirrors `reminder_settings`) holds the editable `brand_voice` and `caption_model` (plus retention/analytics columns created now but unused until features B/C/E). A pure config module (`src/lib/config/social-settings.ts`) owns defaults, model→id resolution, the caption system-prompt builder, and a quote-stripper. A lazy `@anthropic-ai/sdk` client (mirrors `src/lib/email/resend.ts`) lets the build pass without the key. A `generateCaption` server action composes the brand-voice system prompt + idea context and calls Claude. The composer gets a Generate/Regenerate button; the Social settings page gets a Brand voice textarea + model selector saved via `saveSocialSettings`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Supabase (`@supabase/ssr` + service-role admin client), `@anthropic-ai/sdk`, shadcn/ui (Button/Textarea/Select/Label), `useToast`.

> **TESTING NOTE (overrides skill TDD):** This repo has **no test runner**. Per the project conventions, each task is verified with `pnpm lint` and `pnpm build` (both must pass clean), and the whole feature gets a manual smoke at the end. Do NOT add a test framework. Where the skill says "write a failing test," substitute "implement + verify with lint/build."

> **MIGRATION NOTE:** SQL migrations are **run manually in the Supabase SQL editor** — the build does not apply them. The `social_settings` table must exist in the live DB before `getSocialSettings`/`generateCaption` return real data, but the app degrades to defaults if the table/row is missing (no crash). Flag this in the final hand-off so the user runs `migrations/23_social_settings.sql`.

> **SCOPE GUARD:** Build ONLY the groundwork + Feature A. The migration creates all four `social_settings` columns (so B/C/E don't re-migrate), but only `brand_voice` + `caption_model` are wired into the UI/usage. Do NOT build `social_posts` column additions (collaborators/metrics — those belong to B/C), and do NOT touch the Prices/Analytics track.

---

## File Structure

**Create:**
- `migrations/23_social_settings.sql` — the singleton table (4 columns), RLS, seed row.
- `src/lib/config/social-settings.ts` — `SocialSettings` type, defaults, `CAPTION_MODELS` (label→model id), `resolveCaptionModelId`, `buildCaptionSystemPrompt`, `stripSurroundingQuotes`, `normalizeSocialSettings`.
- `src/lib/ai/anthropic.ts` — lazy `getAnthropic()` client.
- `src/app/actions/social-settings.ts` — `getSocialSettings` accessor + `saveSocialSettings` action.
- `src/app/actions/ai.ts` — `generateCaption` server action.
- `src/components/social/social-settings-form.tsx` — client form (brand voice + model select) for the settings page.

**Modify:**
- `src/types/database.ts` — add the `social_settings` table type.
- `src/app/(dashboard)/dashboard/social/settings/page.tsx` — render the new form (fetch settings server-side).
- `src/components/social/post-composer-dialog.tsx` — add Generate/Regenerate button near the caption field.
- `CLAUDE.md` — document the `ANTHROPIC_API_KEY` env var.

---

## Task 1: `social_settings` migration + database type

**Files:**
- Create: `migrations/23_social_settings.sql`
- Modify: `src/types/database.ts` (insert after the `social_post_retailers` block, ~line 145)

- [ ] **Step 1: Write the migration**

Create `migrations/23_social_settings.sql`:

```sql
-- Singleton settings row for the Social Calendar (Phase 3 shared groundwork).
-- Mirrors reminder_settings (id=1 singleton). Created in full now so later
-- Phase 3 features (B collaborators, C analytics, E asset cleanup) don't
-- re-migrate; Feature A only wires brand_voice + caption_model.

create table if not exists social_settings (
  id smallint primary key default 1,
  -- Feature A (AI captions):
  brand_voice text,                                  -- editable brand-voice/style guidance
  caption_model text not null default 'claude-haiku',-- model label resolved to an id in config
  -- Feature E (asset cleanup) — created now, unused until E:
  asset_retention_days int not null default 30,      -- 0 = never delete
  -- Feature C (analytics) — created now, unused until C:
  analytics_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint social_settings_singleton check (id = 1)
);

insert into social_settings (id) values (1) on conflict (id) do nothing;

alter table social_settings enable row level security;

drop policy if exists "social_settings_authenticated_all" on social_settings;
create policy "social_settings_authenticated_all"
  on social_settings for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 2: Add the database type**

In `src/types/database.ts`, immediately after the `social_post_retailers` block (which ends `Update: { post_id?: string; retailer?: string }` then `}`), insert:

```typescript
      social_settings: {
        Row: {
          id: number
          brand_voice: string | null
          caption_model: string
          asset_retention_days: number
          analytics_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          brand_voice?: string | null
          caption_model?: string
          asset_retention_days?: number
          analytics_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          brand_voice?: string | null
          caption_model?: string
          asset_retention_days?: number
          analytics_enabled?: boolean
          updated_at?: string
        }
      }
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean (the migration file isn't compiled; the type addition must not break the build).

- [ ] **Step 4: Commit**

```bash
git add migrations/23_social_settings.sql src/types/database.ts
git commit -m "feat(social): add social_settings singleton table + type (Phase 3 groundwork)"
```

---

## Task 2: `social-settings` config module (defaults, models, prompt, helpers)

**Files:**
- Create: `src/lib/config/social-settings.ts`

- [ ] **Step 1: Write the config module**

Create `src/lib/config/social-settings.ts`:

```typescript
// Shape + defaults for the social_settings singleton (see
// migrations/23_social_settings.sql), plus AI-caption model resolution and
// prompt helpers. Mirrors src/lib/email/settings.ts.

export interface SocialSettings {
  /** Editable brand-voice / style guidance for AI captions ('' = unset). */
  brand_voice: string
  /** Model label (see CAPTION_MODELS); resolved to a concrete id at call time. */
  caption_model: string
  /** Feature E retention (0 = never delete). Stored now, unused in Feature A. */
  asset_retention_days: number
  /** Feature C toggle. Stored now, unused in Feature A. */
  analytics_enabled: boolean
}

export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  brand_voice: '',
  caption_model: 'claude-haiku',
  asset_retention_days: 30,
  analytics_enabled: true,
}

export interface CaptionModelOption {
  value: string
  label: string
  modelId: string
}

// Model ids per the Claude API reference (Haiku 4.5 / Sonnet 4.6 / Opus 4.8).
export const CAPTION_MODELS: CaptionModelOption[] = [
  { value: 'claude-haiku', label: 'Claude Haiku (fast — default)', modelId: 'claude-haiku-4-5-20251001' },
  { value: 'claude-sonnet', label: 'Claude Sonnet (balanced)', modelId: 'claude-sonnet-4-6' },
  { value: 'claude-opus', label: 'Claude Opus (most capable)', modelId: 'claude-opus-4-8' },
]

export const CAPTION_MODEL_VALUES = CAPTION_MODELS.map((m) => m.value)

/** Resolve a stored caption_model label to a concrete model id (falls back to Haiku). */
export function resolveCaptionModelId(value: string): string {
  return CAPTION_MODELS.find((m) => m.value === value)?.modelId ?? CAPTION_MODELS[0].modelId
}

// Base instruction always applied; the editable brand voice is appended when set.
export const CAPTION_BASE_INSTRUCTION =
  'You are a social media copywriter for Wahlburgers at Home, a retail food brand sold in grocery ' +
  'stores. Write a single, ready-to-post social caption (Instagram/Facebook) for the idea described ' +
  'by the user. Keep it concise and natural, on-brand, and you may include a few relevant hashtags. ' +
  'Return ONLY the caption text — no surrounding quotes, no labels, no commentary.'

/** System prompt = base instruction + the editable brand voice (when present). */
export function buildCaptionSystemPrompt(brandVoice: string): string {
  const v = (brandVoice ?? '').trim()
  return v ? `${CAPTION_BASE_INSTRUCTION}\n\nBrand voice guidance:\n${v}` : CAPTION_BASE_INSTRUCTION
}

/** Strip a single layer of surrounding straight/smart quotes the model may add. */
export function stripSurroundingQuotes(s: string): string {
  return s.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
}

/** Coerce a possibly-partial DB row into a complete SocialSettings. */
export function normalizeSocialSettings(
  row: Partial<SocialSettings> | null | undefined
): SocialSettings {
  if (!row) return { ...DEFAULT_SOCIAL_SETTINGS }
  return {
    brand_voice: typeof row.brand_voice === 'string' ? row.brand_voice : DEFAULT_SOCIAL_SETTINGS.brand_voice,
    caption_model: CAPTION_MODEL_VALUES.includes(row.caption_model as string)
      ? (row.caption_model as string)
      : DEFAULT_SOCIAL_SETTINGS.caption_model,
    asset_retention_days:
      typeof row.asset_retention_days === 'number' ? row.asset_retention_days : DEFAULT_SOCIAL_SETTINGS.asset_retention_days,
    analytics_enabled:
      typeof row.analytics_enabled === 'boolean' ? row.analytics_enabled : DEFAULT_SOCIAL_SETTINGS.analytics_enabled,
  }
}
```

> Note: `brand_voice` from the DB is `string | null`; `normalizeSocialSettings` collapses `null` to `''` so the textarea and prompt builder always get a string.

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/config/social-settings.ts
git commit -m "feat(social): social-settings config (defaults, caption models, prompt helpers)"
```

---

## Task 3: Anthropic SDK dependency + lazy client + env doc

**Files:**
- Create: `src/lib/ai/anthropic.ts`
- Modify: `CLAUDE.md` (Environment Variables block)
- Modify: `package.json` / `pnpm-lock.yaml` (via `pnpm add`)

> **REFERENCE:** Before writing the SDK call (this task + Task 5), consult the `claude-api` skill for the current `messages.create` signature, model ids, and SDK import. The model ids in Task 2 (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`) come from that reference.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @anthropic-ai/sdk`
Expected: `@anthropic-ai/sdk` appears in `package.json` dependencies and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Write the lazy client**

Create `src/lib/ai/anthropic.ts` (mirrors `src/lib/email/resend.ts`):

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Lazily construct the client so a missing key fails at call time, not import
// time — this keeps `pnpm build` green without ANTHROPIC_API_KEY set.
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey })
}
```

- [ ] **Step 3: Document the env var in CLAUDE.md**

In `CLAUDE.md`, in the ```` ``` ```` Environment Variables block, after the `ZERNIO_WEBHOOK_SECRET` line, add:

```
ANTHROPIC_API_KEY=<anthropic-api-key>             # Phase 3 AI caption generation
```

- [ ] **Step 4: Verify lint + build (no key set)**

Run: `pnpm lint && pnpm build`
Expected: both pass clean **without** `ANTHROPIC_API_KEY` in the environment (proves lazy init works).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/ai/anthropic.ts CLAUDE.md
git commit -m "feat(ai): add @anthropic-ai/sdk + lazy client + ANTHROPIC_API_KEY doc"
```

---

## Task 4: `getSocialSettings` + `saveSocialSettings` server actions

**Files:**
- Create: `src/app/actions/social-settings.ts`

- [ ] **Step 1: Write the actions**

Create `src/app/actions/social-settings.ts` (mirrors `getReminderSettings`/`saveReminderSettings`):

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_SOCIAL_SETTINGS,
  normalizeSocialSettings,
  CAPTION_MODEL_VALUES,
  type SocialSettings,
} from '@/lib/config/social-settings'

// Reads the singleton social settings (falls back to defaults if signed-out,
// the table is missing, or no row exists).
export async function getSocialSettings(): Promise<SocialSettings> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULT_SOCIAL_SETTINGS }

  try {
    const admin = createSupabaseAdminClient()
    const { data } = await admin
      .from('social_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    return normalizeSocialSettings(data as Partial<SocialSettings> | null)
  } catch (error) {
    console.error('getSocialSettings failed:', error)
    return { ...DEFAULT_SOCIAL_SETTINGS }
  }
}

// Feature A only persists brand_voice + caption_model; retention/analytics
// columns keep their DB defaults (wired up later by features C/E).
export async function saveSocialSettings(input: {
  brand_voice: string
  caption_model: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in to save.' }

  const caption_model = CAPTION_MODEL_VALUES.includes(input.caption_model)
    ? input.caption_model
    : DEFAULT_SOCIAL_SETTINGS.caption_model
  const brand_voice = (input.brand_voice ?? '').slice(0, 4000)

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.from('social_settings').upsert({
      id: 1,
      brand_voice,
      caption_model,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    revalidatePath('/dashboard/social/settings')
    return { success: true }
  } catch (error) {
    console.error('saveSocialSettings failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save settings.',
    }
  }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/social-settings.ts
git commit -m "feat(social): getSocialSettings accessor + saveSocialSettings action"
```

---

## Task 5: `generateCaption` server action

**Files:**
- Create: `src/app/actions/ai.ts`

- [ ] **Step 1: Write the action**

Create `src/app/actions/ai.ts`:

```typescript
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAnthropic } from '@/lib/ai/anthropic'
import { getSocialSettings } from './social-settings'
import {
  resolveCaptionModelId,
  buildCaptionSystemPrompt,
  stripSurroundingQuotes,
} from '@/lib/config/social-settings'

export interface GenerateCaptionInput {
  title?: string | null
  notes?: string | null
  productNames?: string[]
  retailers?: string[]
}

// Builds the idea context the model sees as the user message.
function buildIdeaContext(input: GenerateCaptionInput): string {
  const lines: string[] = []
  if (input.title?.trim()) lines.push(`Title: ${input.title.trim()}`)
  if (input.notes?.trim()) lines.push(`Notes: ${input.notes.trim()}`)
  if (input.productNames?.length) lines.push(`Products: ${input.productNames.join(', ')}`)
  if (input.retailers?.length) lines.push(`Retailers: ${input.retailers.join(', ')}`)
  if (lines.length === 0) {
    lines.push('No specific details provided — write a general on-brand caption for Wahlburgers at Home.')
  }
  return `Write a caption for this post idea:\n\n${lines.join('\n')}`
}

export async function generateCaption(
  input: GenerateCaptionInput
): Promise<{ success: boolean; caption?: string; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in to generate a caption.' }

  const settings = await getSocialSettings()
  const system = buildCaptionSystemPrompt(settings.brand_voice)
  const model = resolveCaptionModelId(settings.caption_model)
  const userMessage = buildIdeaContext(input)

  try {
    const client = getAnthropic()
    const message = await client.messages.create({
      model,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = message.content
      .filter((block): block is { type: 'text'; text: string; citations?: unknown } => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const caption = stripSurroundingQuotes(text)
    if (!caption) return { success: false, error: 'The model returned an empty caption. Try again.' }
    return { success: true, caption }
  } catch (error) {
    console.error('generateCaption failed:', error)
    const message =
      error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')
        ? 'AI captions are not configured yet (missing ANTHROPIC_API_KEY).'
        : error instanceof Error
          ? error.message
          : 'Caption generation failed.'
    return { success: false, error: message }
  }
}
```

> If the `.filter` type-guard predicate causes a TS error against the SDK's `ContentBlock` union, simplify to `message.content.filter((b) => b.type === 'text').map((b) => ('text' in b ? b.text : '')).join('')`. Confirm the exact `ContentBlock` shape from the `claude-api` skill / SDK types.

- [ ] **Step 2: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean (no `ANTHROPIC_API_KEY` needed — the client is only constructed inside the try at call time).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/ai.ts
git commit -m "feat(ai): generateCaption server action (brand-voice prompt + idea context)"
```

---

## Task 6: Social settings page — Brand voice + model selector form

**Files:**
- Create: `src/components/social/social-settings-form.tsx`
- Modify: `src/app/(dashboard)/dashboard/social/settings/page.tsx`

- [ ] **Step 1: Write the client form**

Create `src/components/social/social-settings-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { CAPTION_MODELS, type SocialSettings } from '@/lib/config/social-settings'
import { saveSocialSettings } from '@/app/actions/social-settings'

export function SocialSettingsForm({ initial }: { initial: SocialSettings }) {
  const [brandVoice, setBrandVoice] = useState(initial.brand_voice)
  const [captionModel, setCaptionModel] = useState(initial.caption_model)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  async function handleSave() {
    setSaving(true)
    const res = await saveSocialSettings({ brand_voice: brandVoice, caption_model: captionModel })
    setSaving(false)
    if (!res.success) {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Could not save', description: res.error ?? 'Please try again.' })
      return
    }
    toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Settings saved', description: 'AI caption settings updated.' })
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">AI captions</h2>
        <p className="text-sm text-muted-foreground">Used by the “Generate caption” button in the post composer.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-voice">Brand voice</Label>
        <Textarea
          id="brand-voice"
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          rows={6}
          placeholder="Describe the tone, style, and any do's/don'ts for captions (e.g. “Warm, family-first, a little playful. Mention real ingredients. Avoid hard-sell language.”). Leave blank for a generic on-brand voice."
        />
        <p className="text-xs text-muted-foreground">Guides every generated caption. Leave blank to use a generic on-brand voice.</p>
      </div>

      <div className="space-y-2">
        <Label>Caption model</Label>
        <Select value={captionModel} onValueChange={setCaptionModel}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CAPTION_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the form into the settings page**

Replace `src/app/(dashboard)/dashboard/social/settings/page.tsx` entirely with:

```typescript
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ConnectionStatus } from '@/components/social/connection-status'
import { SocialSettingsForm } from '@/components/social/social-settings-form'
import { getSocialSettings } from '@/app/actions/social-settings'

export const metadata = { title: 'Social Settings' }
export const dynamic = 'force-dynamic'

export default async function SocialSettingsPage() {
  const settings = await getSocialSettings()
  return (
    <PageContainer>
      <PageHeader
        title="Social Settings"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Settings' }]}
      />
      <div className="mt-6 grid max-w-xl gap-6">
        <ConnectionStatus />
        <SocialSettingsForm initial={settings} />
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/social-settings-form.tsx "src/app/(dashboard)/dashboard/social/settings/page.tsx"
git commit -m "feat(social): brand voice + caption model settings UI"
```

---

## Task 7: Composer — "Generate caption" / "Regenerate" button

**Files:**
- Modify: `src/components/social/post-composer-dialog.tsx`

- [ ] **Step 1: Add imports + state + handler**

In `src/components/social/post-composer-dialog.tsx`:

1. Add `Sparkles` to the `lucide-react` import (line 13): change
   `import { Loader2, Trash2, CheckCircle2, CalendarClock, Pencil, AlertTriangle, Send } from 'lucide-react'`
   to
   `import { Loader2, Trash2, CheckCircle2, CalendarClock, Pencil, AlertTriangle, Send, Sparkles } from 'lucide-react'`

2. Add the action import after the `publishPost` import (line 20):
   `import { generateCaption } from '@/app/actions/ai'`

3. Add a `generating` state next to the other `useState`s (after line 57 `const [saving, setSaving] = useState(false)`):
   `const [generating, setGenerating] = useState(false)`

4. Add a `nameOf` helper + `handleGenerate` function (place just before `function togglePlatform`, ~line 90):

```typescript
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? ''

  async function handleGenerate() {
    setGenerating(true)
    const productNames = productIds.map(nameOf).filter(Boolean)
    const res = await generateCaption({
      title,
      notes: post?.notes ?? '',
      productNames,
      retailers,
    })
    setGenerating(false)
    if (!res.success || !res.caption) {
      // Never overwrite the existing caption on failure.
      toast({
        variant: 'destructive',
        icon: <AlertTriangle className="size-5" />,
        title: 'Caption generation failed',
        description: res.error ?? 'Please try again.',
      })
      return
    }
    setCaption(res.caption)
  }
```

- [ ] **Step 2: Add the button next to the Caption label**

Replace the caption field block (lines 202-205):

```typescript
            <div>
              <Label htmlFor="caption">Caption</Label>
              <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption…" />
            </div>
```

with:

```typescript
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="caption">Caption</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-brand hover:text-brand"
                  onClick={handleGenerate}
                  disabled={generating || saving}
                >
                  {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {caption.trim() ? 'Regenerate' : 'Generate caption'}
                </Button>
              </div>
              <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption…" />
            </div>
```

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/post-composer-dialog.tsx
git commit -m "feat(social): Generate/Regenerate caption button in composer"
```

---

## Task 8: Manual smoke + final verification

**Files:** none (verification only)

- [ ] **Step 1: Apply the migration in Supabase**

In the Supabase SQL editor, run the contents of `migrations/23_social_settings.sql`. Confirm a `social_settings` row with `id = 1` exists.

- [ ] **Step 2: Confirm a clean full build**

Run: `pnpm lint && pnpm build`
Expected: both pass clean.

- [ ] **Step 3: Manual smoke (requires `ANTHROPIC_API_KEY` locally or in Vercel)**

Run: `pnpm dev`, then:
1. Go to `/dashboard/social/settings` — set a Brand voice (e.g. "Warm, family-first, a little playful") and pick a model; click **Save**; confirm the success toast and that a reload keeps the values.
2. Go to `/dashboard/social`, open the composer (New post), enter a Title and tag a product + retailer, click **Generate caption** — confirm the spinner, then the caption fills in and is editable; click **Regenerate** for an alternative.
3. Temporarily unset/break the key (or rely on it being absent) and click Generate — confirm a **destructive toast** and that the caption field is NOT overwritten.
4. Toggle dark mode — confirm the settings form and composer button read correctly in light AND dark.

- [ ] **Step 4: Hand off**

Note to the user: the migration must be run manually in Supabase, and `ANTHROPIC_API_KEY` must be set in Vercel for live generation. Then open a PR (do not push to main).

---

## Self-Review (completed by planner)

**Spec coverage (§0 + §A):**
- `social_settings` table, all 4 columns, RLS, seed → Task 1. ✅
- `database.ts` type → Task 1. ✅
- `src/lib/config/social-settings.ts` defaults/normalizer → Task 2. ✅
- `getSocialSettings` accessor → Task 4. ✅
- `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` doc + lazy `src/lib/ai/anthropic.ts` → Task 3. ✅
- `generateCaption({ title, notes, productNames, retailers })` with brand-voice system prompt + idea-context user message, model from settings, returns `{ success, caption }`, strips quotes, never auto-publishes → Task 5. ✅
- Composer Generate/Regenerate button w/ spinner, fills editable caption, destructive toast on error, never overwrites on failure → Task 7. ✅
- Settings page Brand voice textarea + model selector saved via `saveSocialSettings` → Tasks 4 + 6. ✅
- "Works generic if brand voice unset, hint to set it in Settings" → `buildCaptionSystemPrompt` falls back to base instruction (Task 2); settings textarea placeholder + helper text point users to set it (Task 6). ✅
- Scope guard: retention/analytics columns created but not wired into UI (saveSocialSettings omits them; form only edits brand_voice + caption_model). ✅ No `social_posts` changes. ✅

**Placeholder scan:** No TBD/TODO/"add error handling" placeholders; all code blocks complete. ✅

**Type consistency:** `SocialSettings`, `normalizeSocialSettings`, `resolveCaptionModelId`, `buildCaptionSystemPrompt`, `stripSurroundingQuotes`, `CAPTION_MODELS`, `CAPTION_MODEL_VALUES` defined in Task 2 and used consistently in Tasks 4/5/6. `getSocialSettings`/`saveSocialSettings` signatures match between Tasks 4, 6. `generateCaption` input shape matches the composer call in Task 7. ✅
```
