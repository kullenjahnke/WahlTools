import { SOCIAL_PLATFORM_VALUES } from '@/lib/config/social'

export interface PublishValidationInput {
  format: string
  platforms: string[]
  caption: string | null
  media: { media_type: 'image' | 'video' }[]
}

const CAPTION_MAX = 2200 // Instagram caption limit

// Returns an error string if the post can't be published, else null.
// Per-format media constraints mirror Instagram's documented limits.
export function validateForPublish(input: PublishValidationInput): string | null {
  const { format, platforms, caption, media } = input

  if (!platforms.length) return 'Pick at least one platform (Instagram and/or Facebook).'
  if (!platforms.every((p) => (SOCIAL_PLATFORM_VALUES as string[]).includes(p))) {
    return 'Unsupported platform selected.'
  }
  if ((caption?.length ?? 0) > CAPTION_MAX) return `Caption is too long (max ${CAPTION_MAX} characters).`

  const images = media.filter((m) => m.media_type === 'image').length
  const videos = media.filter((m) => m.media_type === 'video').length

  switch (format) {
    case 'image':
      if (images !== 1 || videos !== 0) return 'A single-image post needs exactly one image.'
      break
    case 'carousel':
      if (media.length < 2) return 'A carousel needs at least 2 media items.'
      if (media.length > 10) return 'A carousel can have at most 10 media items.'
      break
    case 'reel':
      if (videos !== 1 || images !== 0) return 'A reel needs exactly one video.'
      break
    case 'story':
      if (media.length !== 1) return 'A story needs exactly one image or video.'
      break
    default:
      return 'Unknown post format.'
  }
  return null
}
