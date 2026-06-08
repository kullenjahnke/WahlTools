import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ConnectionStatus } from '@/components/social/connection-status'

export const metadata = { title: 'Social Settings' }
export const dynamic = 'force-dynamic'

export default function SocialSettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Social Settings"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Settings' }]}
      />
      <div className="mt-6 max-w-xl">
        <ConnectionStatus />
      </div>
    </PageContainer>
  )
}
