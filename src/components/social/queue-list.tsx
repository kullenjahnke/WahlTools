'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CheckCircle2, Trash2, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Chip } from '@/components/ui/chip'
import { StatusChip } from './status-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RowActions } from '@/components/ui/row-actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PostComposerDialog } from './post-composer-dialog'
import { deleteSocialPost, updatePostStatus } from '@/app/actions/social'
import { SOCIAL_STATUSES, formatLabel, postLabel, statusMeta } from '@/lib/config/social'
import { detroitTime, detroitYmd } from '@/lib/social/dates'
import type { SocialPostRecord } from '@/lib/social/queries'
import type { ProductOption } from './tag-picker'

export function QueueList({ posts, products }: { posts: SocialPostRecord[]; products: ProductOption[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editing, setEditing] = useState<SocialPostRecord | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmPost, setConfirmPost] = useState<SocialPostRecord | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const filtered = useMemo(
    () => (statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter)),
    [posts, statusFilter]
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SOCIAL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No posts.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => { setEditing(p); setOpen(true) }}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <StatusChip status={p.status} />
                <span className="truncate text-sm font-medium">{postLabel(p)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{formatLabel(p.format)}</span>
                <span>·</span>
                <span>{p.scheduled_at ? `${detroitYmd(p.scheduled_at)} ${detroitTime(p.scheduled_at)}` : 'Unscheduled'}</span>
                {p.product_names.map((n, i) => <Chip key={`${p.id}-pn-${i}`} label={n} tone="auto" colorKey={p.product_ids[i]} size="sm" />)}
                {p.retailers.map((r) => <Chip key={`${p.id}-r-${r}`} label={r} tone="brand" size="sm" />)}
              </div>
            </button>
            <RowActions
              actions={[
                { label: 'Edit', onSelect: () => { setEditing(p); setOpen(true) } },
                ...(p.status !== 'posted'
                  ? [{ label: 'Mark as posted', separatorBefore: true, onSelect: async () => {
                      const res = await updatePostStatus(p.id, 'posted')
                      if (res.success) {
                        toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Status updated', description: `"${postLabel(p)}" is now ${statusMeta('posted').label}` })
                      } else {
                        toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
                      }
                      router.refresh()
                    } }]
                  : []),
                ...(p.status !== 'failed'
                  ? [{ label: 'Mark as failed', onSelect: async () => {
                      const res = await updatePostStatus(p.id, 'failed')
                      if (res.success) {
                        toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Status updated', description: `"${postLabel(p)}" is now ${statusMeta('failed').label}` })
                      } else {
                        toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
                      }
                      router.refresh()
                    } }]
                  : []),
                { label: 'Delete', destructive: true, separatorBefore: true, onSelect: () => setConfirmPost(p) },
              ]}
            />
          </div>
        ))}
      </div>

      <PostComposerDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        post={editing}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmPost}
        onOpenChange={(v) => { if (!v) setConfirmPost(null) }}
        title="Delete post?"
        description={confirmPost ? `"${postLabel(confirmPost)}" will be permanently deleted. This can't be undone.` : ''}
        confirmLabel="Delete"
        destructive
        loading={confirmLoading}
        onConfirm={async () => {
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
        }}
      />
    </div>
  )
}
