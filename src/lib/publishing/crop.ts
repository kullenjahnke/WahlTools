import sharp from 'sharp'
import { aspectRatioNumber } from '@/lib/config/social'

// Center-crops an image buffer to the given aspect ratio value ('1:1' etc.).
// 'auto' (or unknown) returns the original buffer unchanged. Returns the
// cropped (or original) buffer plus the output extension.
export async function cropImageToRatio(
  input: Buffer,
  aspectRatio: string
): Promise<{ buffer: Buffer; ext: string }> {
  const ratio = aspectRatioNumber(aspectRatio) // number (w/h) or null for 'auto'
  if (ratio == null) return { buffer: input, ext: 'jpg' }

  const img = sharp(input, { failOn: 'none' })
  const meta = await img.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (!w || !h) return { buffer: input, ext: 'jpg' }

  const currentRatio = w / h
  let cropW = w
  let cropH = h
  if (currentRatio > ratio) {
    cropW = Math.round(h * ratio)
  } else if (currentRatio < ratio) {
    cropH = Math.round(w / ratio)
  }
  const left = Math.max(0, Math.round((w - cropW) / 2))
  const top = Math.max(0, Math.round((h - cropH) / 2))

  const out = await img
    .extract({ left, top, width: cropW, height: cropH })
    .jpeg({ quality: 90 })
    .toBuffer()
  return { buffer: out, ext: 'jpg' }
}
