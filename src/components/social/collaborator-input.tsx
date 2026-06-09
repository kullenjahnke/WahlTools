'use client'

import { useState, type KeyboardEvent } from 'react'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

const MAX = 3
// Mirrors the server action: strip leading '@', trim, lowercase, then validate.
const HANDLE_RE = /^[a-z0-9._]{1,30}$/

function normalize(raw: string): string {
  return raw.replace(/^@+/, '').trim().toLowerCase()
}

export function CollaboratorInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const atMax = value.length >= MAX

  function add() {
    const name = normalize(draft)
    if (!name) return
    if (!HANDLE_RE.test(name)) {
      setErr('Letters, numbers, periods, and underscores only.')
      return
    }
    if (value.includes(name)) {
      setDraft('')
      setErr(null)
      return
    }
    if (value.length >= MAX) {
      setErr(`Up to ${MAX} collaborators.`)
      return
    }
    onChange([...value, name])
    setDraft('')
    setErr(null)
  }

  function remove(name: string) {
    onChange(value.filter((c) => c !== name))
    setErr(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((c) => (
            <Chip
              key={c}
              tone="neutral"
              size="sm"
              label={
                <span className="flex items-center gap-1">
                  @{c}
                  <X className="size-3 cursor-pointer" onClick={() => remove(c)} />
                </span>
              }
            />
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setErr(null) }}
        onKeyDown={onKeyDown}
        onBlur={add}
        disabled={atMax}
        placeholder={atMax ? 'Maximum 3 collaborators' : 'Add a username, press Enter'}
        className="h-8"
      />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">
        Collaborators co-author the post — it&apos;s shared to their followers and shows them as a co-author. Instagram only; Business or Creator accounts.
      </p>
    </div>
  )
}
