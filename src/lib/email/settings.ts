// Shape + defaults for the reminder settings singleton (see
// migrations/14_reminder_settings.sql).

export interface ReminderSettings {
  /** 0 = Sunday .. 6 = Saturday (America/Detroit). */
  weekly_day: number
  /** 0-23 (America/Detroit). */
  weekly_hour: number
  /** Recipients for the weekly reminder + follow-up. */
  recipients: string[]
  followup_enabled: boolean
  /** Days after the weekly reminder the follow-up fires (1-2). */
  followup_days_after: number
  /** A retailer is "stale" if it hasn't had a price update in more than this many days. */
  stale_threshold_days: number
  na_digest_enabled: boolean
  /** Recipients for the N/A (unavailable products) digest. */
  na_recipients: string[]
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  weekly_day: 3, // Wednesday
  weekly_hour: 9, // 9 AM
  recipients: ["info@kullenjahnke.com", "rjahnke@arkkfood.com"],
  followup_enabled: true,
  followup_days_after: 2,
  stale_threshold_days: 11,
  na_digest_enabled: true,
  na_recipients: ["rjahnke@arkkfood.com"],
}

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const

export function parseEmails(input: string): string[] {
  return input
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatEmails(emails: string[]): string {
  return emails.join(", ")
}

/** Coerce a possibly-partial DB row into a complete ReminderSettings. */
export function normalizeSettings(row: Partial<ReminderSettings> | null | undefined): ReminderSettings {
  if (!row) return { ...DEFAULT_REMINDER_SETTINGS }
  return {
    weekly_day: row.weekly_day ?? DEFAULT_REMINDER_SETTINGS.weekly_day,
    weekly_hour: row.weekly_hour ?? DEFAULT_REMINDER_SETTINGS.weekly_hour,
    recipients: row.recipients?.length ? row.recipients : DEFAULT_REMINDER_SETTINGS.recipients,
    followup_enabled: row.followup_enabled ?? DEFAULT_REMINDER_SETTINGS.followup_enabled,
    followup_days_after: row.followup_days_after ?? DEFAULT_REMINDER_SETTINGS.followup_days_after,
    stale_threshold_days: row.stale_threshold_days ?? DEFAULT_REMINDER_SETTINGS.stale_threshold_days,
    na_digest_enabled: row.na_digest_enabled ?? DEFAULT_REMINDER_SETTINGS.na_digest_enabled,
    na_recipients: row.na_recipients?.length ? row.na_recipients : DEFAULT_REMINDER_SETTINGS.na_recipients,
  }
}
