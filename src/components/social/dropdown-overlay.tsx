'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// A floating dropdown panel for the post composer's chip fields (Tags,
// Collaborators). It (a) overlays the fields below it instead of expanding the
// modal vertically, and (b) animates in/out identically to the shadcn <Select>
// dropdowns (Format/Status) — same tailwindcss-animate classes driven by a
// data-state attribute. Requires a `relative`-positioned ancestor.
//
// Presence is handled manually (mount on open; keep mounted through the exit
// animation, then unmount). A timeout backstops the unmount so reduced-motion
// users — where the CSS animation may not run — don't get a stuck panel.
const ANIMATION =
  'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 ' +
  'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 ' +
  'data-[state=open]:slide-in-from-top-2'

export function DropdownOverlay({
  open,
  className,
  children,
}: {
  open: boolean
  className?: string
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  // Last content rendered while open, shown during the exit animation so a panel
  // that closes because its list went empty fades out its previous contents
  // rather than an empty box.
  const cached = useRef<ReactNode>(children)
  if (open) cached.current = children

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(t)
  }, [open])

  if (!mounted) return null

  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'absolute left-0 right-0 top-full z-50 mt-1 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md',
        ANIMATION,
        className
      )}
    >
      {open ? children : cached.current}
    </div>
  )
}
