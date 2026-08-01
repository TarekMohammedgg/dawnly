const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/

function isValidGregorianParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Formats an ISO calendar date (YYYY-MM-DD) as DD/MM/YYYY. */
export function formatDisplayDate(isoDate: string): string {
  if (!ISO_DATE.test(isoDate)) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

/** Returns today's calendar date in the local timezone as YYYY-MM-DD. */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parses a strict DD/MM/YYYY display date into YYYY-MM-DD.
 * Returns null for malformed or impossible Gregorian dates.
 */
export function parseDisplayDate(displayDate: string): string | null {
  const match = DISPLAY_DATE.exec(displayDate.trim())
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!isValidGregorianParts(year, month, day)) {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  return isValidGregorianParts(year ?? 0, month ?? 0, day ?? 0)
}
