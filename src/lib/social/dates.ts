// Date helpers for the calendar. scheduled_at is an ISO timestamp; the app
// displays/groups in America/Detroit (consistent with the price reminders).

const YMD_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Detroit',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 'yyyy-MM-dd' key for an ISO timestamp, in America/Detroit. */
export function detroitYmd(iso: string): string {
  return YMD_FMT.format(new Date(iso))
}

/** 'yyyy-MM-dd' key for a local Date's calendar day (used to key grid cells). */
export function localYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  hour: 'numeric',
  minute: '2-digit',
})

/** e.g. "2:00 PM" in America/Detroit. */
export function detroitTime(iso: string): string {
  return TIME_FMT.format(new Date(iso))
}
