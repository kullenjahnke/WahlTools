"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { saveReminderSettings } from "@/app/actions/reminders"
import {
  WEEKDAY_NAMES,
  parseEmails,
  formatEmails,
  type ReminderSettings,
} from "@/lib/email/settings"
import { Bell, CalendarClock, PackageX } from "lucide-react"

function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${period}`
}

export function ReminderSettingsForm({ initial }: { initial: ReminderSettings }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [weeklyDay, setWeeklyDay] = useState(initial.weekly_day)
  const [weeklyHour, setWeeklyHour] = useState(initial.weekly_hour)
  const [recipients, setRecipients] = useState(formatEmails(initial.recipients))

  const [followupEnabled, setFollowupEnabled] = useState(initial.followup_enabled)
  const [followupDaysAfter, setFollowupDaysAfter] = useState(initial.followup_days_after)
  const [staleThreshold, setStaleThreshold] = useState(initial.stale_threshold_days)

  const [naEnabled, setNaEnabled] = useState(initial.na_digest_enabled)
  const [naRecipients, setNaRecipients] = useState(formatEmails(initial.na_recipients))

  const followupDayName = WEEKDAY_NAMES[(weeklyDay + followupDaysAfter) % 7]

  const handleSave = async () => {
    setSaving(true)
    const res = await saveReminderSettings({
      weekly_day: weeklyDay,
      weekly_hour: weeklyHour,
      recipients: parseEmails(recipients),
      followup_enabled: followupEnabled,
      followup_days_after: followupDaysAfter,
      stale_threshold_days: staleThreshold,
      na_digest_enabled: naEnabled,
      na_recipients: parseEmails(naRecipients),
    })
    toast({
      title: res.ok ? "Saved" : "Error",
      description: res.message,
      variant: res.ok ? undefined : "destructive",
    })
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Weekly reminder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-muted-foreground" />
            Weekly reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={String(weeklyDay)} onValueChange={(v) => setWeeklyDay(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAY_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Select value={String(weeklyHour)} onValueChange={(v) => setWeeklyHour(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipients">Email destination</Label>
            <Input
              id="recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="name@example.com, name2@example.com"
            />
            <p className="text-xs text-muted-foreground">Separate multiple emails with commas. The reminder is sent on the selected day each week (morning, US&nbsp;Eastern).</p>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              Follow-up reminder
            </span>
            <Switch checked={followupEnabled} onCheckedChange={setFollowupEnabled} aria-label="Enable follow-up" />
          </CardTitle>
        </CardHeader>
        {followupEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Days after weekly reminder</Label>
                <Select value={String(followupDaysAfter)} onValueChange={(v) => setFollowupDaysAfter(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stale">Stale threshold (days)</Label>
                <Input
                  id="stale"
                  type="number"
                  min={1}
                  value={staleThreshold}
                  onChange={(e) => setStaleThreshold(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Fires <span className="font-medium text-foreground">{followupDayName}</span> for any retailer
              with no price update in more than {staleThreshold} days. Sent to the weekly recipients.
            </p>
          </CardContent>
        )}
      </Card>

      {/* N/A digest */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <PackageX className="size-4 text-muted-foreground" />
              Unavailable (N/A) digest
            </span>
            <Switch checked={naEnabled} onCheckedChange={setNaEnabled} aria-label="Enable N/A digest" />
          </CardTitle>
        </CardHeader>
        {naEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="na-recipients">Email destination</Label>
              <Input
                id="na-recipients"
                value={naRecipients}
                onChange={(e) => setNaRecipients(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A weekly list of products newly marked N/A, sent alongside the follow-up on {followupDayName}.
            </p>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  )
}
