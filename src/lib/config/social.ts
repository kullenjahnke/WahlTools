// Display config + validation for the Social Calendar. Chip tones are raw
// class strings (light + dark) passed straight to <Chip tone=...>.

export const SOCIAL_STATUSES = [
  { value: 'idea',      label: 'Idea',      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',       accent: '#d97706' },
  { value: 'draft',     label: 'Draft',     tone: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-400/15 dark:text-zinc-300',           accent: '#71717a' },
  { value: 'scheduled', label: 'Scheduled', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',           accent: '#2563eb' },
  { value: 'posted',    label: 'Posted',    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300', accent: '#059669' },
  { value: 'failed',    label: 'Failed',    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',           accent: '#e11d48' },
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

// The single IG/FB account the calendar plans for (v1). avatarUrl points at a
// file you can drop into /public; the preview falls back to a monogram if it's
// missing. Phase 2 can replace this with a per-account table.
export const SOCIAL_ACCOUNT = {
  handle: 'wahlburgersathome',
  avatarUrl: '/social-avatar.png',
} as const

export const SOCIAL_ASPECT_RATIOS = [
  { value: 'auto',   label: 'Auto (match image)', ratio: null },
  { value: '1:1',    label: 'Square (1:1)',       ratio: 1 },
  { value: '4:5',    label: 'Portrait (4:5)',     ratio: 0.8 },
  { value: '3:4',    label: 'Portrait (3:4)',     ratio: 0.75 },
  { value: '1.91:1', label: 'Landscape (1.91:1)', ratio: 1.91 },
] as const

export type SocialAspectRatio = (typeof SOCIAL_ASPECT_RATIOS)[number]['value']
export const SOCIAL_ASPECT_RATIO_VALUES = SOCIAL_ASPECT_RATIOS.map((a) => a.value) as SocialAspectRatio[]

/** Numeric width/height ratio for a value, or null for 'auto'. */
export function aspectRatioNumber(value: string): number | null {
  return SOCIAL_ASPECT_RATIOS.find((a) => a.value === value)?.ratio ?? null
}
