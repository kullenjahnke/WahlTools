'use client'

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu'
import { SOCIAL_STATUSES } from '@/lib/config/social'

// Right-click quick actions for a calendar post. The trigger wraps the tile in
// a div (so Radix can attach a ref); left-click behavior on the tile is unaffected.
export function PostContextMenu({
  children,
  onEdit,
  onPickDate,
  onQuickReschedule,
  onSetStatus,
  onDuplicate,
  onDelete,
}: {
  children: React.ReactNode
  onEdit: () => void
  onPickDate: () => void
  onQuickReschedule: (days: number) => void
  onSetStatus: (status: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onEdit}>Edit post</ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Change date / time</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => onQuickReschedule(1)}>Move +1 day</ContextMenuItem>
            <ContextMenuItem onSelect={() => onQuickReschedule(7)}>Move +1 week</ContextMenuItem>
            <ContextMenuItem onSelect={() => onQuickReschedule(-1)}>Move −1 day</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onPickDate}>Pick exact…</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Change status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {SOCIAL_STATUSES.map((s) => (
              <ContextMenuItem key={s.value} onSelect={() => onSetStatus(s.value)}>{s.label}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onSelect={onDuplicate}>Duplicate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
