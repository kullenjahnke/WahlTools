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
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
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
