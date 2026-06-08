'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostTile } from './post-tile'
import { reschedulePost } from '@/app/actions/social'
import { localYmd } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function SocialCalendar({
  year,
  monthIndex,
  posts,
  onOpen,
}: {
  year: number
  monthIndex: number
  posts: SocialPostRecord[]
  onOpen?: (arg: { postId?: string; date?: string }) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const monthDate = new Date(year, monthIndex, 1)

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const byDay = new Map<string, SocialPostRecord[]>()
  for (const p of posts) {
    if (!p.scheduled_at) continue
    // Group by the same local day-basis used to key grid cells below (consistent
    // for the Detroit-based team; avoids cross-timezone cell mismatch).
    const key = localYmd(new Date(p.scheduled_at))
    const arr = byDay.get(key) ?? []
    arr.push(p)
    byDay.set(key, arr)
  }

  function goMonth(delta: number) {
    const d = addMonths(monthDate, delta)
    router.push(`/dashboard/social?month=${format(d, 'yyyy-MM')}`)
  }

  async function handleDrop(e: React.DragEvent, dayKey: string) {
    e.preventDefault()
    const postId = e.dataTransfer.getData('text/plain')
    if (!postId) return
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const prev = post.scheduled_at ? new Date(post.scheduled_at) : new Date()
    const [y, m, d] = dayKey.split('-').map(Number)
    const next = new Date(prev)
    next.setFullYear(y, m - 1, d)
    if (!post.scheduled_at) next.setHours(12, 0, 0, 0)
    setPending(true)
    await reschedulePost(postId, next.toISOString())
    setPending(false)
    router.refresh()
  }

  return (
    <div aria-busy={pending}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{format(monthDate, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/social')}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const key = localYmd(day)
          const dayPosts = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, monthDate)
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, key)}
              onClick={() => onOpen?.({ date: key })}
              className={[
                'min-h-[104px] rounded-lg border p-1.5 transition-colors',
                inMonth ? 'bg-card border-border' : 'bg-muted/40 border-transparent',
                isToday(day) ? 'ring-1 ring-brand border-brand' : '',
                'hover:border-brand/50 cursor-pointer',
              ].join(' ')}
            >
              <div className={`mb-1 text-xs font-semibold ${inMonth ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              {dayPosts.map((p) => (
                <PostTile
                  key={p.id}
                  post={p}
                  onClick={() => onOpen?.({ postId: p.id })}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
