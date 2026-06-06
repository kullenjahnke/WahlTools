import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Settings" }

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <p className="text-muted-foreground">Settings management coming soon…</p>
    </PageContainer>
  )
}
