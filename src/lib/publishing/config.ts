// Zernio (formerly Late) API config. Account IDs are resolved at runtime from
// GET /v1/accounts (mapped by platform), so only the API key + webhook secret
// are env-configured.
export const ZERNIO_BASE = 'https://zernio.com/api/v1'

export function zernioApiKey(): string {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('ZERNIO_API_KEY is not set')
  return key
}

export function zernioWebhookSecret(): string {
  const s = process.env.ZERNIO_WEBHOOK_SECRET
  if (!s) throw new Error('ZERNIO_WEBHOOK_SECRET is not set')
  return s
}

export const SOCIAL_PUBLISH_URL =
  'https://wahlburgers-price-tracker.vercel.app/dashboard/social'
