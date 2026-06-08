'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
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
import { ChevronLeft, ChevronRight, CalendarClock, CheckCircle2, Copy, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PostTile } from './post-tile'
import { reschedulePost, updatePostStatus, deleteSocialPost, duplicateSocialPost } from '@/app/actions/social'
import { PostContextMenu } from './post-context-menu'
import { localYmd } from '@/lib/social/dates'
import { postLabel, statusMeta } from '@/lib/config/social'
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
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [confirmPost, setConfirmPost] = useState<SocialPostRecord | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
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

  async function quickReschedule(post: SocialPostRecord, days: number) {
    const base = post.scheduled_at ? new Date(post.scheduled_at) : new Date()
    base.setDate(base.getDate() + days)
    setPending(true)
    const res = await reschedulePost(post.id, base.toISOString())
    setPending(false)
    if (res.success) {
      toast({ icon: <CalendarClock className="size-5 text-brand" />, title: 'Post rescheduled', description: `"${postLabel(post)}"` })
    } else {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
    }
    router.refresh()
  }

  async function setStatus(post: SocialPostRecord, status: string) {
    setPending(true)
    const res = await updatePostStatus(post.id, status)
    setPending(false)
    if (res.success) {
      toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Status updated', description: `"${postLabel(post)}" is now ${statusMeta(status).label}` })
    } else {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
    }
    router.refresh()
  }

  async function duplicate(post: SocialPostRecord) {
    setPending(true)
    const res = await duplicateSocialPost(post.id)
    setPending(false)
    if (res.success) {
      toast({ icon: <Copy className="size-5 text-brand" />, title: 'Post duplicated', description: `Draft copy of "${postLabel(post)}"` })
    } else {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
    }
    router.refresh()
  }

  function del(post: SocialPostRecord) {
    setConfirmPost(post)
  }

  async function performDelete() {
    if (!confirmPost) return
    const post = confirmPost
    setConfirmLoading(true)
    const res = await deleteSocialPost(post.id)
    setConfirmLoading(false)
    setConfirmPost(null)
    if (res.success) {
      toast({ icon: <Trash2 className="size-5 text-muted-foreground" />, title: 'Post deleted', description: `"${postLabel(post)}"` })
    } else {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
    }
    router.refresh()
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
    const res = await reschedulePost(postId, next.toISOString())
    setPending(false)
    if (res.success) {
      toast({ icon: <CalendarClock className="size-5 text-brand" />, title: 'Post rescheduled', description: `"${postLabel(post)}"` })
    } else {
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
    }
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
                <PostContextMenu
                  key={p.id}
                  onEdit={() => onOpen?.({ postId: p.id })}
                  onPickDate={() => onOpen?.({ postId: p.id })}
                  onQuickReschedule={(days) => quickReschedule(p, days)}
                  onSetStatus={(s) => setStatus(p, s)}
                  onDuplicate={() => duplicate(p)}
                  onDelete={() => del(p)}
                >
                  <PostTile
                    post={p}
                    onClick={() => onOpen?.({ postId: p.id })}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                  />
                </PostContextMenu>
              ))}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!confirmPost}
        onOpenChange={(v) => { if (!v) setConfirmPost(null) }}
        title="Delete post?"
        description={confirmPost ? `"${postLabel(confirmPost)}" will be permanently deleted. This can't be undone.` : ''}
        confirmLabel="Delete"
        destructive
        loading={confirmLoading}
        onConfirm={performDelete}
      />
    </div>
  )
}
