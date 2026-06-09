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
  return s.trim().replace(/^["'""'']+|["'""'']+$/g, '').trim()
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
