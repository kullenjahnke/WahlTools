'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Trash2, CheckCircle2, CalendarClock, Pencil, AlertTriangle, Send, Sparkles } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SOCIAL_FORMATS, SOCIAL_STATUSES, SOCIAL_PLATFORMS, SOCIAL_ASPECT_RATIOS, postLabel, deriveFormat, deriveAspect } from '@/lib/config/social'
import { TagPicker, type ProductOption } from './tag-picker'
import { CollaboratorInput } from './collaborator-input'
import { MediaDropzone, type MediaItem } from './media-dropzone'
import { PostPreview } from './post-preview'
import { createSocialPost, updateSocialPost, deleteSocialPost } from '@/app/actions/social'
import { publishPost } from '@/app/actions/publish'
import { generateCaption } from '@/app/actions/ai'
import type { SocialPostRecord } from '@/lib/social/queries'

// Converts an ISO timestamp to the value a datetime-local input expects (local wall clock).
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PostComposerDialog({
  open,
  onOpenChange,
  products,
  post,
  initialDate,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: ProductOption[]
  post?: SocialPostRecord | null
  initialDate?: string // 'yyyy-MM-dd'
  onSaved: () => void
}) {
  const [caption, setCaption] = useState('')
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<string>('image')
  const [aspectRatio, setAspectRatio] = useState<string>('auto')
  const [formatTouched, setFormatTouched] = useState(false)
  const [aspectTouched, setAspectTouched] = useState(false)
  const [status, setStatus] = useState<string>('idea')
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [when, setWhen] = useState<string>('')
  const [productIds, setProductIds] = useState<string[]>([])
  const [retailers, setRetailers] = useState<string[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    if (post) {
      setTitle(post.title ?? '')
      setCaption(post.caption ?? '')
      setFormat(post.format)
      setAspectRatio(post.aspect_ratio ?? 'auto')
      setStatus(post.status)
      setPlatforms(post.platforms.length ? post.platforms : ['instagram', 'facebook'])
      setCollaborators(post.collaborators ?? [])
      setWhen(toLocalInput(post.scheduled_at))
      setProductIds(post.product_ids)
      setRetailers(post.retailers)
      setMedia(post.media.map((m) => ({ url: m.url, storage_path: m.storage_path, media_type: m.media_type, position: m.position })))
      setFormatTouched(true)
      setAspectTouched(true)
    } else {
      setTitle('')
      setCaption('')
      setFormat('image')
      setAspectRatio('auto')
      setStatus('idea')
      setPlatforms(['instagram', 'facebook'])
      setCollaborators([])
      setWhen(initialDate ? `${initialDate}T12:00` : '')
      setProductIds([])
      setRetailers([])
      setMedia([])
      setFormatTouched(false)
      setAspectTouched(false)
    }
    setError(null)
  }, [open, post, initialDate])

  // Auto-derive format/aspect from media unless the user has manually touched the field.
  // Clearing media to empty resets the touched flags so derivation can resume (new posts only).
  useEffect(() => {
    // Edit mode is fully sticky: never auto-derive from media for an existing post.
    if (post) return
    if (media.length === 0) {
      setFormatTouched(false)
      setAspectTouched(false)
      return
    }
    if (!formatTouched) {
      const f = deriveFormat(media)
      if (f) setFormat(f)
    }
    if (!aspectTouched) {
      const a = deriveAspect(media)
      if (a) setAspectRatio(a)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media])

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? ''

  async function handleGenerate() {
    setGenerating(true)
    try {
      const productNames = productIds.map(nameOf).filter(Boolean)
      // Cover image (lowest-position image media item) as a visual reference;
      // video-only / image-less posts generate from text alone, as before.
      const coverImage = media
        .filter((m) => m.media_type === 'image')
        .sort((a, b) => a.position - b.position)[0]
      const res = await generateCaption({
        title,
        notes: post?.notes ?? '',
        productNames,
        retailers,
        imageUrl: coverImage?.url ?? null,
      })
      if (!res.success || !res.caption) {
        // Never overwrite the existing caption on failure.
        toast({
          variant: 'destructive',
          icon: <AlertTriangle className="size-5" />,
          title: 'Caption generation failed',
          description: res.error ?? 'Please try again.',
        })
        return
      }
      setCaption(res.caption)
    } catch {
      toast({
        variant: 'destructive',
        icon: <AlertTriangle className="size-5" />,
        title: 'Caption generation failed',
        description: 'Please try again.',
      })
    } finally {
      setGenerating(false)
    }
  }

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const input = {
      title,
      caption,
      format,
      aspect_ratio: aspectRatio,
      status,
      scheduled_at: when ? new Date(when).toISOString() : null,
      platforms,
      collaborators,
      productIds,
      retailers,
      media,
    }
    const res = post ? await updateSocialPost(post.id, input) : await createSocialPost(input)
    setSaving(false)
    const label = postLabel({ title, caption })
    if (!res.success) {
      setError(res.error ?? 'Failed to save')
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
      return
    }
    if (post) {
      toast({ icon: <Pencil className="size-5 text-brand" />, title: 'Post updated', description: `"${label}"` })
    } else if (status === 'scheduled') {
      toast({ icon: <CalendarClock className="size-5 text-brand" />, title: 'Post scheduled', description: `"${label}"` })
    } else {
      toast({ icon: <CheckCircle2 className="size-5 text-brand" />, title: 'Post saved', description: `"${label}"` })
    }
    onOpenChange(false)
    onSaved()
  }

  async function performDelete() {
    if (!post) return
    setSaving(true)
    setError(null)
    const label = postLabel({ title, caption })
    const res = await deleteSocialPost(post.id)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to delete')
      setConfirmOpen(false)
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: res.error ?? 'Please try again.' })
      return
    }
    toast({ icon: <Trash2 className="size-5 text-muted-foreground" />, title: 'Post deleted', description: `"${label}"` })
    setConfirmOpen(false)
    onOpenChange(false)
    onSaved()
  }

  async function handlePublishNow() {
    setSaving(true)
    setError(null)
    // Publish-now saves as draft (no pre-schedule, no date requirement); the
    // immediate publishPost below does the single send and flips status to posted.
    const input = {
      title,
      caption,
      format,
      aspect_ratio: aspectRatio,
      status: 'draft',
      scheduled_at: when ? new Date(when).toISOString() : null,
      platforms,
      collaborators,
      productIds,
      retailers,
      media,
    }
    const saved = post ? await updateSocialPost(post.id, input) : await createSocialPost(input)
    if (!saved.success || !saved.data) {
      setSaving(false)
      setError(saved.error ?? 'Could not save')
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Something went wrong', description: saved.error ?? 'Please try again.' })
      return
    }
    const pub = await publishPost(saved.data, { now: true })
    setSaving(false)
    if (!pub.success) {
      setError(pub.error ?? 'Publish failed')
      toast({ variant: 'destructive', icon: <AlertTriangle className="size-5" />, title: 'Publish failed', description: pub.error ?? 'Please try again.' })
      return
    }
    toast({ icon: <Send className="size-5 text-brand" />, title: 'Publishing now', description: `"${postLabel({ title, caption })}"` })
    onOpenChange(false)
    onSaved()
  }

  const statusOptions = post ? SOCIAL_STATUSES : SOCIAL_STATUSES.filter((s) => ['idea', 'draft', 'scheduled'].includes(s.value))

  const label = postLabel({ title, caption })

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit post' : 'New post'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short internal title (optional)" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="caption">Caption</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-brand hover:text-brand"
                  onClick={handleGenerate}
                  disabled={generating || saving}
                >
                  {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {caption.trim() ? 'Regenerate' : 'Generate caption'}
                </Button>
              </div>
              <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Write a caption…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => { setFormatTouched(true); setFormat(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOCIAL_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(format === 'image' || format === 'carousel') && (
              <div>
                <Label>Aspect ratio</Label>
                <Select value={aspectRatio} onValueChange={(v) => { setAspectTouched(true); setAspectRatio(v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOCIAL_ASPECT_RATIOS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Media</Label>
              <MediaDropzone media={media} onChange={setMedia} />
            </div>

            <div>
              <Label>Publish to</Label>
              <div className="flex gap-2">
                {SOCIAL_PLATFORMS.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      platforms.includes(p.value) ? 'border-brand bg-brand-muted text-brand font-medium' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {platforms.includes('instagram') && (
              <div>
                <Label>Collaborators</Label>
                <CollaboratorInput value={collaborators} onChange={setCollaborators} />
              </div>
            )}

            <div>
              <Label htmlFor="when">When</Label>
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>

            <div>
              <Label>Tags</Label>
              <TagPicker
                products={products}
                selectedProductIds={productIds}
                onProductsChange={setProductIds}
                selectedRetailers={retailers}
                onRetailersChange={setRetailers}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <PostPreview caption={caption} media={media} platforms={platforms} format={format} aspectRatio={aspectRatio} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {post && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={saving} className="text-destructive">
                <Trash2 className="mr-1 size-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmPublish(true)} disabled={saving}>
              <Send className="mr-1 size-4" /> Publish now
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
              {status === 'scheduled' ? 'Schedule' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Delete post?"
      description={`"${label}" will be permanently deleted. This can't be undone.`}
      confirmLabel="Delete"
      destructive
      loading={saving}
      onConfirm={performDelete}
    />
    <ConfirmDialog
      open={confirmPublish}
      onOpenChange={setConfirmPublish}
      title="Publish now?"
      description={`"${postLabel({ title, caption })}" will post to Instagram/Facebook immediately.`}
      confirmLabel="Publish now"
      loading={saving}
      onConfirm={() => { setConfirmPublish(false); handlePublishNow() }}
    />
    </>
  )
}
