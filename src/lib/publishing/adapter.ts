// Vendor-agnostic publishing interface. One concrete impl (Zernio) lives in
// zernio-client.ts; swapping vendors means adding another impl, nothing else.

export type PublishMediaType = 'image' | 'video'

export interface PublishMedia {
  url: string
  type: PublishMediaType
}

export interface PublishRequest {
  caption: string
  /** Ordered media (already cropped/derived). */
  media: PublishMedia[]
  /** Our platform values, e.g. ['instagram','facebook']. */
  platforms: string[]
  /** IG collaborator usernames (no leading '@'); applied to Instagram only, max 3. */
  collaborators?: string[]
  /** Our format: image | carousel | reel | story. Drives per-platform content type. */
  format: string
  /** ISO timestamp for scheduled publishing; omit for publish-now. */
  scheduledFor?: string
  /** Optional Instagram reel cover image URL (already cropped to 9:16). Instagram-only. */
  instagramThumbnailUrl?: string
}

export interface PublishResult {
  vendorId: string
  /** Normalized: scheduled | posted | failed | partial | cancelled | pending. */
  status: string
}

export interface PublishStatus {
  status: string
  /** Human-readable failure detail if failed/partial. */
  error?: string
}

export interface PublishAdapter {
  schedule(req: PublishRequest): Promise<PublishResult>
  publishNow(req: PublishRequest): Promise<PublishResult>
  getStatus(vendorId: string): Promise<PublishStatus>
  /** Cancels a not-yet-published post. Idempotent: treats "already gone" as success. */
  cancel(vendorId: string): Promise<void>
}
