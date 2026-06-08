'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Instagram, Facebook } from 'lucide-react'
import type { MediaItem } from './media-dropzone'
import { SOCIAL_ACCOUNT } from '@/lib/config/social'

function Avatar() {
  const [err, setErr] = useState(false)
  if (err || !SOCIAL_ACCOUNT.avatarUrl) {
    return (
      <div className="flex size-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">W</div>
    )
  }
  return (
    <Image
      src={SOCIAL_ACCOUNT.avatarUrl}
      alt=""
      width={24}
      height={24}
      className="size-6 rounded-full object-cover"
      onError={() => setErr(true)}
    />
  )
}

// Phone-style preview. Shape follows the format (square for image/carousel,
// 9:16 for reel/story); carousels show all media in a snap strip with dots.
export function PostPreview({
  caption,
  media,
  platforms,
  format,
}: {
  caption: string
  media: MediaItem[]
  platforms: string[]
  format: string
}) {
  const isPortrait = format === 'reel' || format === 'story'
  const aspect = isPortrait ? 'aspect-[9/16]' : 'aspect-square'
  const isCarousel = format === 'carousel' && media.length > 1

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {platforms.includes('instagram') && <Instagram className="size-4" />}
        {platforms.includes('facebook') && <Facebook className="size-4" />}
        <span>Preview</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Avatar />
          <span className="text-xs font-semibold">{SOCIAL_ACCOUNT.handle}</span>
        </div>
        <div className={`relative ${aspect} bg-muted`}>
          {media.length === 0 ? (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">No media yet</div>
          ) : isCarousel ? (
            <div className="flex size-full snap-x snap-mandatory overflow-x-auto">
              {media.map((m) => (
                <div key={m.storage_path} className="relative size-full shrink-0 snap-center">
                  {m.media_type === 'image' ? (
                    <Image src={m.url} alt="" fill sizes="220px" className="object-cover" />
                  ) : (
                    <video src={m.url} className="size-full object-cover" controls />
                  )}
                </div>
              ))}
            </div>
          ) : media[0].media_type === 'image' ? (
            <Image src={media[0].url} alt="" fill sizes="220px" className="object-cover" />
          ) : (
            <video src={media[0].url} className="size-full object-cover" controls />
          )}
          {isCarousel && (
            <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center gap-1">
              {media.map((m) => <span key={m.storage_path} className="size-1.5 rounded-full bg-white/80 shadow" />)}
            </div>
          )}
        </div>
        <div className="p-2 text-xs text-foreground">
          <span className="font-semibold">{SOCIAL_ACCOUNT.handle}</span>{' '}
          <span className="text-muted-foreground">{caption || 'Your caption will appear here…'}</span>
        </div>
      </div>
    </div>
  )
}
