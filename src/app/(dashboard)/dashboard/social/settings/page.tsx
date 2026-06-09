import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ConnectionStatus } from '@/components/social/connection-status'
import { SocialSettingsForm } from '@/components/social/social-settings-form'
import { getSocialSettings } from '@/app/actions/social-settings'

export const metadata = { title: 'Social Settings' }
export const dynamic = 'force-dynamic'

export default async function SocialSettingsPage() {
  const settings = await getSocialSettings()
  return (
    <PageContainer>
      <PageHeader
        title="Social Settings"
        breadcrumbs={[{ label: 'Social', href: '/dashboard/social' }, { label: 'Settings' }]}
      />
      <div className="mt-6 grid max-w-xl gap-6">
        <ConnectionStatus />
        <SocialSettingsForm initial={settings} />
      </div>
    </PageContainer>
  )
}
