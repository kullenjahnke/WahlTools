import { ZERNIO_BASE, zernioApiKey } from './config'
import type { PublishAdapter, PublishRequest, PublishResult, PublishStatus } from './adapter'

async function zfetch(path: string, init?: RequestInit) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${zernioApiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })
  return res
}

let accountCache: Record<string, string> | null = null
export async function resolveAccountIds(): Promise<Record<string, string>> {
  if (accountCache) return accountCache
  const res = await zfetch('/accounts')
  if (!res.ok) throw new Error(`Zernio accounts fetch failed: ${res.status}`)
  const body = (await res.json()) as { accounts?: ZernioAccount[] } | ZernioAccount[]
  const accounts: ZernioAccount[] = Array.isArray(body) ? body : body.accounts ?? []
  const map: Record<string, string> = {}
  for (const a of accounts) {
    if (a.isActive !== false && a.platform && a._id && !map[a.platform]) map[a.platform] = a._id
  }
  accountCache = map
  return map
}
interface ZernioAccount { _id: string; platform: string; username?: string; isActive?: boolean }

function contentTypeFor(format: string): Record<string, unknown> | undefined {
  if (format === 'reel') return { contentType: 'reels' }
  if (format === 'story') return { contentType: 'story' }
  return undefined
}

function normalizeStatus(zStatus: string): string {
  switch (zStatus) {
    case 'published': return 'posted'
    case 'partial': return 'partial'
    case 'failed': return 'failed'
    case 'cancelled': return 'cancelled'
    case 'scheduled':
    case 'pending':
    case 'draft':
    default: return 'scheduled'
  }
}

async function buildBody(req: PublishRequest, publishNow: boolean) {
  const accounts = await resolveAccountIds()
  const basePsd = contentTypeFor(req.format)
  const collaborators = (req.collaborators ?? []).slice(0, 3)
  const missing = req.platforms.filter((p) => !accounts[p])
  if (missing.length > 0) {
    throw new Error(`Not connected for: ${missing.join(', ')}. Connect the account(s) in Zernio first.`)
  }
  const platforms = req.platforms.map((p) => {
    // Instagram carries extra platformSpecificData: collaborators and (for reels)
    // a custom cover. Facebook just uses the base content-type data.
    let psd: Record<string, unknown> | undefined = basePsd
    if (p === 'instagram') {
      const extra: Record<string, unknown> = { ...(basePsd ?? {}) }
      if (collaborators.length > 0) extra.collaborators = collaborators
      if (req.instagramThumbnailUrl) extra.instagramThumbnail = req.instagramThumbnailUrl
      psd = Object.keys(extra).length > 0 ? extra : undefined
    }
    return {
      platform: p,
      accountId: accounts[p],
      ...(psd ? { platformSpecificData: psd } : {}),
    }
  })

  return {
    content: req.caption,
    mediaItems: req.media.map((m) => ({ type: m.type, url: m.url })),
    platforms,
    ...(publishNow ? { publishNow: true } : { scheduledFor: req.scheduledFor, timezone: 'UTC' }),
  }
}

async function createPost(req: PublishRequest, publishNow: boolean): Promise<PublishResult> {
  const body = await buildBody(req, publishNow)
  const res = await zfetch('/posts', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio create post failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as { post?: { _id: string; status?: string } }
  const post = json.post
  if (!post?._id) throw new Error('Zernio create post: missing post id in response')
  return { vendorId: post._id, status: normalizeStatus(post.status ?? 'scheduled') }
}

export const zernioAdapter: PublishAdapter = {
  schedule: (req) => createPost(req, false),
  publishNow: (req) => createPost(req, true),

  async getStatus(vendorId: string): Promise<PublishStatus> {
    const res = await zfetch(`/posts/${vendorId}`)
    if (res.status === 404) return { status: 'cancelled' }
    if (!res.ok) throw new Error(`Zernio status failed: ${res.status}`)
    const json = (await res.json()) as {
      post?: { status?: string; platforms?: { status?: string; error?: string }[] }
    }
    const status = normalizeStatus(json.post?.status ?? 'scheduled')
    const error = (json.post?.platforms ?? []).find((p) => p.error)?.error
    return { status, error }
  },

  async cancel(vendorId: string): Promise<void> {
    const res = await zfetch(`/posts/${vendorId}`, { method: 'DELETE' })
    if (res.ok || res.status === 404) return
    const text = await res.text().catch(() => '')
    throw new Error(`Zernio cancel failed: ${res.status} ${text}`)
  },
}
