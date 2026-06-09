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

/** Coerce arbitrary input into a valid retention window: integer in [0, 3650] (0 = never delete). */
function clampRetentionDays(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SOCIAL_SETTINGS.asset_retention_days
  return Math.min(3650, Math.max(0, Math.floor(n)))
}

// Persists brand_voice + caption_model (Feature A) and asset_retention_days
// (Feature E). analytics_enabled keeps its DB default until Feature C wires it up.
export async function saveSocialSettings(input: {
  brand_voice: string
  caption_model: string
  asset_retention_days: number
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
  const asset_retention_days = clampRetentionDays(input.asset_retention_days)

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.from('social_settings').upsert({
      id: 1,
      brand_voice,
      caption_model,
      asset_retention_days,
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
