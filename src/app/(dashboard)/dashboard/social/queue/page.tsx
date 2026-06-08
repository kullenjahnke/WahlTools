import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAllPosts } from '@/lib/social/queries'
import { QueueList } from '@/components/social/queue-list'

export const metadata = { title: 'Queue' }
export const dynamic = 'force-dynamic'

export default async function SocialQueuePage() {
  const supabase = await createSupabaseServerClient()
  const [posts, productsRes] = await Promise.all([
    getAllPosts(supabase),
    supabase.from('products').select('id, name').order('name'),
  ])
  const products = (productsRes.data ?? []) as { id: string; name: string }[]

  return (
    <PageContainer>
      <PageHeader
        title="Queue"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Queue' }]}
      />
      <div className="mt-6">
        <QueueList posts={posts} products={products} />
      </div>
    </PageContainer>
  )
}
