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
