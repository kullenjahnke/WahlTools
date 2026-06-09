'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { COLLABORATOR_PRESETS, type CollaboratorPreset } from '@/lib/config/social'

const MAX = 3
// Mirrors the server action: strip leading '@', trim, lowercase, then validate.
const HANDLE_RE = /^[a-z0-9._]{1,30}$/
// Fixed display order for grouped suggestions.
const GROUP_ORDER: CollaboratorPreset['group'][] = ['Family', 'Brand', 'Retailers']

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
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const atMax = value.length >= MAX

  // Presets matching the draft (by label or handle), excluding already-added
  // ones, sorted into the fixed group order. `sort` is stable, so config order
  // is preserved within each group.
  const matches = useMemo(() => {
    const q = normalize(draft)
    if (!q) return []
    return COLLABORATOR_PRESETS
      .filter((p) => !value.includes(p.handle) && (p.label.toLowerCase().includes(q) || p.handle.includes(q)))
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
  }, [draft, value])

  const showDropdown = open && !atMax && matches.length > 0

  // Close the dropdown on click-outside (mousedown fires before input blur).
  useEffect(() => {
    if (!showDropdown) return
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showDropdown])

  // Add a handle through the shared normalize/validate/cap path. Used by both
  // free-text entry (the draft) and preset selection (an exact handle).
  function commit(raw: string) {
    const name = normalize(raw)
    if (!name) return
    if (!HANDLE_RE.test(name)) {
      setErr('Letters, numbers, periods, and underscores only.')
      return
    }
    if (value.includes(name)) {
      setDraft(''); setErr(null); setOpen(false); setHighlight(-1)
      return
    }
    if (value.length >= MAX) {
      setErr(`Up to ${MAX} collaborators.`)
      return
    }
    onChange([...value, name])
    setDraft(''); setErr(null); setOpen(false); setHighlight(-1)
  }

  function remove(name: string) {
    onChange(value.filter((c) => c !== name))
    setErr(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, -1))
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      // Enter on a highlighted suggestion picks it; otherwise add the typed text.
      if (e.key === 'Enter' && highlight >= 0 && matches[highlight]) {
        commit(matches[highlight].handle)
      } else {
        commit(draft)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="space-y-1.5" ref={rootRef}>
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
                  <X
                    className="size-3 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => remove(c)}
                  />
                </span>
              }
            />
          ))}
        </div>
      )}

      <Input
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setErr(null); setOpen(true); setHighlight(-1) }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        disabled={atMax}
        placeholder={atMax ? 'Maximum 3 collaborators' : 'Search or type a username…'}
        className="h-8"
      />

      {showDropdown && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {GROUP_ORDER.map((g) => {
            const items = matches.filter((p) => p.group === g)
            if (!items.length) return null
            return (
              <div key={g}>
                <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase text-muted-foreground">{g}</p>
                {items.map((p) => {
                  const idx = matches.indexOf(p)
                  return (
                    <button
                      type="button"
                      key={p.handle}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => commit(p.handle)}
                      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${idx === highlight ? 'bg-accent' : 'hover:bg-accent'}`}
                    >
                      <span className="text-foreground">{p.label}</span>
                      <span className="text-xs text-muted-foreground">@{p.handle}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}
      <p className="text-xs text-muted-foreground">
        Collaborators co-author the post — it&apos;s shared to their followers and shows them as a co-author. Instagram only; Business or Creator accounts.
      </p>
    </div>
  )
}
