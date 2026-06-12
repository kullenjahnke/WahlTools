'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Label } from '@/components/ui/label'
import { ImagePlus, RotateCcw, Loader2 } from 'lucide-react'

export function ReelCoverField({
  coverUrl,
  isCustom,
  busy,
  onPickCustom,
  onResetAuto,
}: {
  coverUrl: string | null
  isCustom: boolean
  busy?: boolean
  onPickCustom: (file: File) => void
  onResetAuto: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Label>Reel cover</Label>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill sizes="54px" className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">No cover</div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-brand/60 disabled:opacity-60"
          >
            <ImagePlus className="size-3.5" /> Upload custom cover
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={onResetAuto}
              disabled={busy}
              className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" /> Reset to auto
            </button>
          )}
          <p className="text-[11px] text-muted-foreground">Instagram only. Defaults to the video&apos;s first frame.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPickCustom(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
    </div>
  )
}
