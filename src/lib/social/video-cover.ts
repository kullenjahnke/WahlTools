// Client-side first-frame capture for reel covers. Draws the video's first
// frame to a canvas FROM THE LOCAL File (same-origin blob URL, so the canvas is
// not tainted and can be exported). Resolves null on any failure.
export function captureFirstFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const cleanup = () => { URL.revokeObjectURL(url); clearTimeout(timeout) }
    const fail = () => { resolve(null); cleanup() }
    const timeout = setTimeout(() => fail(), 8000)

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      // Seek a hair past 0 to avoid a black initial frame on some encodings.
      try { video.currentTime = Math.min(0.1, video.duration || 0.1) } catch { fail() }
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) { fail(); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => { resolve(blob ?? null); cleanup() }, 'image/jpeg', 0.9)
      } catch { fail() }
    }
    video.onerror = fail
    video.src = url
  })
}
