import { Chip } from '@/components/ui/chip'
import { ZERNIO_BASE, zernioApiKey } from '@/lib/publishing/config'

// Server component: reads connected accounts from Zernio and shows status.
export async function ConnectionStatus() {
  let accounts: { platform: string; username?: string }[] = []
  let error: string | null = null
  try {
    const res = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: { Authorization: `Bearer ${zernioApiKey()}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const body = (await res.json()) as { accounts?: typeof accounts } | typeof accounts
    accounts = Array.isArray(body) ? body : body.accounts ?? []
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not reach Zernio'
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Publishing not connected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set <code>ZERNIO_API_KEY</code> and connect Instagram + Facebook in the Zernio dashboard. ({error})
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium text-foreground">Connected accounts</p>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts connected yet — connect them in the Zernio dashboard.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Chip key={`${a.platform}-${a.username}`} tone="brand" label={`${a.platform}: @${a.username ?? 'connected'} ✓`} />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Scheduling a post here will <strong>auto-publish</strong> it at the set time.
      </p>
    </div>
  )
}
