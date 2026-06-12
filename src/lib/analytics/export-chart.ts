// src/lib/analytics/export-chart.ts
import { toPng } from "html-to-image"

/** Filename-safe slug: lowercase, non-alphanumerics → single dashes, trimmed. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Fetch an image URL and return a data URL, so html-to-image can inline it
 * without tripping cross-origin canvas tainting. Returns null on any failure
 * (caller falls back to a placeholder).
 */
export async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Rasterize a DOM node to a PNG and trigger a download.
 * pixelRatio 2 → crisp output; cacheBust avoids stale inlined resources.
 */
export async function exportNodeToPng(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
  const link = document.createElement("a")
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const LOGO_URL = "/email-logo.png"

/**
 * Load the white WahlTools wordmark and return a PNG data URL recolored for the theme:
 * kept white for dark exports, recolored to black for light exports (via 'source-in', which
 * preserves alpha). Same-origin asset, so the canvas isn't tainted. Resolves null on any failure.
 */
export function themedLogoDataUrl(isDark: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        if (!isDark) {
          // Recolor opaque pixels to black, preserving alpha (the wordmark shape).
          ctx.globalCompositeOperation = "source-in"
          ctx.fillStyle = "#000000"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        resolve(canvas.toDataURL("image/png"))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = LOGO_URL
  })
}
