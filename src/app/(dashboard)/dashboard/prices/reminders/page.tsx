import { getReminderSettings } from "@/app/actions/reminders"
import { ReminderSettingsForm } from "@/components/prices/reminder-settings-form"
import { SendTestReminderButton } from "@/components/prices/send-test-reminder-button"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "WahlTools | Reminders" }

export default async function PriceRemindersPage() {
  const settings = await getReminderSettings()

  return (
    <PageContainer>
      <PageHeader
        title="Price Reminders"
        breadcrumbs={[
          { label: "Prices", href: "/dashboard/prices" },
          { label: "Reminders" },
        ]}
        actions={<SendTestReminderButton />}
      />
      <ReminderSettingsForm initial={settings} />
    </PageContainer>
  )
}
