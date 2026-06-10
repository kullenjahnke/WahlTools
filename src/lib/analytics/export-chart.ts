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
