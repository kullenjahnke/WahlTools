'use client'

import Image from 'next/image'
import { Film, ImageIcon, Images, Square } from 'lucide-react'
import { statusMeta, type SocialFormat } from '@/lib/config/social'
import { detroitTime } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'
import { Chip } from '@/components/ui/chip'

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
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="group mb-1 flex w-full items-center gap-1.5 rounded-md border border-border bg-card p-1 text-left transition-colors hover:bg-accent"
      data-status={post.status}
      style={{ borderLeft: `3px solid ${meta.accent}` }}
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
          {post.title?.trim() || post.caption?.trim() || 'Untitled post'}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {post.platforms.map((p) => (p === 'instagram' ? 'IG' : 'FB')).join(' · ')}
          {time ? ` · ${time}` : ''}
        </span>
        {post.collaborators.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {post.collaborators.map((c) => (
              <Chip key={c} tone="neutral" size="sm" label={`@${c}`} />
            ))}
          </span>
        )}
      </span>
    </button>
  )
}
