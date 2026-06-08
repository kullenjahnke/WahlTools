'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, X } from 'lucide-react'
import { uploadSocialImage, createSocialVideoUploadUrl } from '@/app/actions/social'
import { createClientClient } from '@/lib/supabase/client'

export interface MediaItem { url: string; storage_path: string; media_type: 'image' | 'video'; position: number }

const BUCKET = 'social-media'

export function MediaDropzone({
  media,
  onChange,
}: {
  media: MediaItem[]
  onChange: (m: MediaItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    const next = [...media]
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('video/')) {
          const signed = await createSocialVideoUploadUrl(file.name)
          if (!signed.success) throw new Error(signed.error)
          const supabase = createClientClient()
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(signed.data.path, signed.data.token, file)
          if (upErr) throw upErr
          next.push({ url: signed.data.url, storage_path: signed.data.path, media_type: 'video', position: next.length })
        } else {
          const fd = new FormData()
          fd.append('file', file)
          const res = await uploadSocialImage(fd)
          if (!res.success) throw new Error(res.error)
          next.push({ ...res.data, position: next.length })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      }
    }
    onChange(next.map((m, i) => ({ ...m, position: i })))
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(idx: number) {
    onChange(media.filter((_, i) => i !== idx).map((m, i) => ({ ...m, position: i })))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {media.map((m, i) => (
          <div key={m.storage_path} className="relative size-16 overflow-hidden rounded-md border border-border bg-muted">
            {m.media_type === 'image' ? (
              <Image src={m.url} alt="" width={64} height={64} className="size-16 object-cover" />
            ) : (
              <video src={m.url} className="size-16 object-cover" />
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white"
              aria-label="Remove media"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragActive(true) }}
        onDragEnter={(e) => { e.preventDefault(); if (!busy) setDragActive(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (!busy) handleFiles(e.dataTransfer.files)
        }}
        disabled={busy}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-6 text-sm transition-colors disabled:opacity-60 ${
          dragActive
            ? 'border-brand bg-brand-muted text-foreground'
            : 'border-border bg-muted/40 text-muted-foreground hover:border-brand/60 hover:text-foreground'
        }`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? 'Uploading…' : dragActive ? 'Drop to upload' : 'Drag & drop, or click to add images / video'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
