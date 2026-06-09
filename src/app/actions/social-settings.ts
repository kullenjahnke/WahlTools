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
