import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { ListChecks, Settings } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPostsInRange } from '@/lib/social/queries'
import { SocialBoard } from '@/components/social/social-board'

export const metadata = { title: 'Social' }
export const dynamic = 'force-dynamic'

function monthBounds(month: string | undefined) {
  const now = new Date()
  let year = now.getFullYear()
  let monthIndex = now.getMonth()
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    year = y
    monthIndex = m - 1
  }
  const start = new Date(year, monthIndex, 1)
  start.setDate(start.getDate() - 7)
  const end = new Date(year, monthIndex + 1, 1)
  end.setDate(end.getDate() + 7)
  return { year, monthIndex, startIso: start.toISOString(), endIso: end.toISOString() }
}

export default async function SocialCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const { year, monthIndex, startIso, endIso } = monthBounds(month)
  const supabase = await createSupabaseServerClient()
  const [posts, productsRes] = await Promise.all([
    getPostsInRange(supabase, startIso, endIso),
    supabase.from('products').select('id, name').order('name'),
  ])
  const products = (productsRes.data ?? []) as { id: string; name: string }[]

  return (
    <PageContainer>
      <PageHeader
        title="Social"
        actions={
          <>
            <IconButton href="/dashboard/social/settings" label="Settings" icon={<Settings className="size-4" />} />
            <IconButton href="/dashboard/social/queue" label="Queue" icon={<ListChecks className="size-4" />} />
          </>
        }
      />
      <div className="mt-6">
        <SocialBoard year={year} monthIndex={monthIndex} posts={posts} products={products} />
      </div>
    </PageContainer>
  )
}
