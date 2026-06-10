// src/lib/weeks.ts
//
// EST (America/New_York) Monday-anchored week helpers, mirroring getWeekStartEST
// in src/app/actions/prices.ts so client week math lines up with server WoW math.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Monday 00:00 in America/New_York for the week containing `date`, returned as
 * the equivalent UTC instant.
 */
export function getWeekStartEST(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ""
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const dayOffset = dayMap[get("weekday")] ?? 0
  const year = parseInt(get("year"))
  const month = parseInt(get("month")) - 1
  const day = parseInt(get("day")) - dayOffset
  const monday = new Date(Date.UTC(year, month, day, 5, 0, 0)) // assume EST (UTC-5)
  // DST correction: Mar–Oct use EDT (UTC-4)
  const m = monday.getUTCMonth()
  if (m >= 2 && m <= 10) monday.setUTCHours(4)
  return monday
}

/**
 * The last `count` completed weeks (Monday-anchored EST), STRICTLY BEFORE the
 * current week, most recent first. Anchored at Monday noon before subtracting so
 * a DST ±1h drift never crosses a day boundary.
 */
export function recentCompletedWeekStarts(count: number, now: Date = new Date()): Date[] {
  const currentMondayNoon = new Date(getWeekStartEST(now).getTime() + 12 * 60 * 60 * 1000)
  const out: Date[] = []
  for (let i = 1; i <= count; i++) {
    out.push(getWeekStartEST(new Date(currentMondayNoon.getTime() - i * WEEK_MS)))
  }
  return out
}

/** "Week of Jun 2" — the week-start date formatted in EST. */
export function formatWeekLabel(weekStart: Date): string {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(weekStart)
  return `Week of ${label}`
}

/** True if `ts` falls within [weekStart, weekStart + 7 days). */
export function isInWeek(weekStart: Date, ts: string | Date): boolean {
  const t = new Date(ts).getTime()
  return t >= weekStart.getTime() && t < weekStart.getTime() + WEEK_MS
}
