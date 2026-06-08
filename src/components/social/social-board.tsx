'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SocialCalendar } from './social-calendar'
import { PostComposerDialog } from './post-composer-dialog'
import type { ProductOption } from './tag-picker'
import type { SocialPostRecord } from '@/lib/social/queries'

// Owns composer open/close + which post is being edited, around the calendar.
export function SocialBoard({
  year,
  monthIndex,
  posts,
  products,
}: {
  year: number
  monthIndex: number
  posts: SocialPostRecord[]
  products: ProductOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SocialPostRecord | null>(null)
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined)

  function openFor({ postId, date }: { postId?: string; date?: string }) {
    if (postId) {
      setEditing(posts.find((p) => p.id === postId) ?? null)
      setInitialDate(undefined)
    } else {
      setEditing(null)
      setInitialDate(date)
    }
    setOpen(true)
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => openFor({ date: undefined })}>
          <Plus className="mr-1 size-4" /> New post
        </Button>
      </div>
      <SocialCalendar year={year} monthIndex={monthIndex} posts={posts} onOpen={openFor} />
      <PostComposerDialog
        open={open}
        onOpenChange={setOpen}
        products={products}
        post={editing}
        initialDate={initialDate}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
