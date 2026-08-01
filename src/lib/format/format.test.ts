import { describe, expect, it } from 'vitest'
import { formatAmount } from '../format/amount'
import { formatDisplayDate } from '../format/date'
import { pathToRouteId } from '../routing/routes'

describe('formatAmount', () => {
  it('formats whole EGP amounts for Arabic display', () => {
    const formatted = formatAmount(250)
    expect(formatted).toContain('ج.م')
    expect(formatted).toBe(`${(250).toLocaleString('ar-EG')} ج.م`)
  })
})

describe('formatDisplayDate', () => {
  it('formats ISO dates as DD/MM/YYYY', () => {
    expect(formatDisplayDate('2026-07-28')).toBe('28/07/2026')
  })

  it('rejects invalid ISO dates', () => {
    expect(() => formatDisplayDate('28/07/2026')).toThrow()
  })
})

describe('pathToRouteId', () => {
  it('maps known paths and falls back to dashboard', () => {
    expect(pathToRouteId('/')).toBe('dashboard')
    expect(pathToRouteId('/ledger')).toBe('ledger')
    expect(pathToRouteId('/person')).toBe('person')
    expect(pathToRouteId('/unknown')).toBe('dashboard')
  })
})
