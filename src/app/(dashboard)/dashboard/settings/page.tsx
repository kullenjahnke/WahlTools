import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { AccountSettings } from "@/components/settings/account-settings"

export const metadata = { title: "WahlTools | Settings" }

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <AccountSettings email={user?.email ?? ""} />
    </PageContainer>
  )
}
