import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { zernioWebhookSecret } from '@/lib/publishing/config'
import { sendPublishFailure } from '@/lib/email/send-publish-failure'
import { normalizeSettings, type ReminderSettings } from '@/lib/email/settings'

export const dynamic = 'force-dynamic'

const BUCKET = 'social-media'

function verify(raw: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', zernioWebhookSecret()).update(raw).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const sig = request.headers.get('x-zernio-signature') ?? request.headers.get('x-late-signature')
  if (!verify(raw, sig)) return new NextResponse('Invalid signature', { status: 401 })

  let payload: { event?: string; post?: { _id?: string; platforms?: { status?: string; error?: string }[] } }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad payload', { status: 400 })
  }

  const event = payload.event ?? ''
  const vendorId = payload.post?._id
  if (!vendorId) return NextResponse.json({ ok: true, ignored: 'no post id' })

  const admin = createSupabaseAdminClient()
  const { data: post } = await admin
    .from('social_posts')
    .select('id, title, caption, scheduled_at, external_ref')
    .filter('external_ref->>vendorId', 'eq', vendorId)
    .maybeSingle()
  if (!post) return NextResponse.json({ ok: true, ignored: 'no matching post' })

  const p = post as { id: string; title: string | null; caption: string | null; scheduled_at: string | null; external_ref: { croppedPaths?: string[] } | null }

  if (event === 'post.published' || event === 'post.partial') {
    await admin.from('social_posts').update({
      status: 'posted', posted_at: new Date().toISOString(), failure_reason: null, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    if (p.external_ref?.croppedPaths?.length) await admin.storage.from(BUCKET).remove(p.external_ref.croppedPaths)
    if (event === 'post.partial') {
      const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Partially published'
      await notifyFailure(admin, p, `Partially published: ${reason}`)
    }
  } else if (event === 'post.failed') {
    const reason = (payload.post?.platforms ?? []).find((x) => x.error)?.error ?? 'Publish failed'
    await admin.from('social_posts').update({
      status: 'failed', failure_reason: reason, updated_at: new Date().toISOString(),
    }).eq('id', p.id)
    await notifyFailure(admin, p, reason)
  }

  return NextResponse.json({ ok: true })
}

async function notifyFailure(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  post: { id: string; title: string | null; caption: string | null; scheduled_at: string | null },
  reason: string
) {
  try {
    const { data } = await admin.from('reminder_settings').select('*').eq('id', 1).maybeSingle()
    const settings = normalizeSettings(data as Partial<ReminderSettings> | null)
    const label = post.title?.trim() || post.caption?.trim() || 'Untitled post'
    await sendPublishFailure(settings.social_recipients, { label, reason, when: post.scheduled_at })
  } catch (e) {
    console.error('publish failure email failed:', e)
  }
}
