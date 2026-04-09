import { differenceInDays, startOfToday } from 'date-fns'

/**
 * Parse a YYYY-MM-DD date string as local midnight (not UTC).
 * Fixes timezone issues where parseISO gives UTC midnight which can
 * shift the date by a day for AEST (UTC+10) users.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Today's date as YYYY-MM-DD in local timezone */
export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function isShowComplete(endDate: string): boolean {
  return endDate < todayStr()
}

export function daysUntilStart(startDate: string): number {
  return differenceInDays(parseLocalDate(startDate), startOfToday())
}

export function getFaviconUrl(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null
  try {
    const domain = new URL(websiteUrl).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  } catch {
    return null
  }
}
