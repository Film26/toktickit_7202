// Dashboard day boundaries (docs/lab-04/specification.md BR-22). The service
// desk works in Asia/Bangkok (UTC+7, no daylight saving), so "today" starts
// at 00:00 Bangkok time; timestamps in the database stay in UTC.

export const DASHBOARD_TIME_ZONE = 'Asia/Bangkok'
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function bangkokDayStart(now: Date = new Date()): Date {
  const bangkokMs = now.getTime() + BANGKOK_OFFSET_MS
  const bangkokMidnight = Math.floor(bangkokMs / DAY_MS) * DAY_MS
  return new Date(bangkokMidnight - BANGKOK_OFFSET_MS)
}
