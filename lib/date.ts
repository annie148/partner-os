/**
 * Returns today's date as YYYY-MM-DD in America/Los_Angeles (Pacific) timezone.
 * All date comparisons in the app should use Pacific time since
 * users are on the West Coast and Vercel crons run in UTC.
 */
export function todayPacific(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/**
 * Returns true if today is a weekday (Mon–Fri) in Pacific time.
 */
export function isWeekdayPacific(): boolean {
  const day = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' })
  return day !== 'Sat' && day !== 'Sun'
}

/**
 * Returns a YYYY-MM-DD string offset by `days` from today in Pacific time.
 */
export function offsetDaysPacific(days: number): string {
  // Parse today in Pacific, add days, then format back in Pacific
  const base = new Date(todayPacific() + 'T12:00:00')
  base.setDate(base.getDate() + days)
  return base.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}
