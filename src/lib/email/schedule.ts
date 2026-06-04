// Pure timezone logic. Returns America/Detroit weekday (0=Sun..6=Sat) and hour (0-23).
export function getDetroitParts(date: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date)

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? ""
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0"

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  let hour = parseInt(hourStr, 10)
  if (hour === 24) hour = 0 // some runtimes emit "24" for midnight with hour12:false

  return { weekday: weekdayMap[weekdayStr] ?? -1, hour }
}

// True only at the 9 AM Wednesday America/Detroit hour.
export function shouldSendReminder(date: Date): boolean {
  const { weekday, hour } = getDetroitParts(date)
  return weekday === 3 && hour === 9
}
