/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import {
  applyTransactionListFilters,
  normalizePersonName,
  isUniqueViolation,
} from './transactions'

describe('transaction helpers', () => {
  it('normalizes person names before matching', () => {
    expect(normalizePersonName('  سارة   علي  ')).toBe('سارة علي')
  })

  it('detects Postgres unique violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation({ code: '42P01' })).toBe(false)
  })

  it('applies list filters including normalized name search', () => {
    const calls: Array<[string, unknown]> = []
    const query = {
      eq(column: string, value: string | number) {
        calls.push(['eq', [column, value]])
        return query
      },
      gte(column: string, value: string) {
        calls.push(['gte', [column, value]])
        return query
      },
      lte(column: string, value: string) {
        calls.push(['lte', [column, value]])
        return query
      },
      ilike(column: string, pattern: string) {
        calls.push(['ilike', [column, pattern]])
        return query
      },
    }

    applyTransactionListFilters(query, {
      name: ' أحمد ',
      direction: 'payable',
      amount: 50,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      currency: 'EGP',
    })

    expect(calls).toEqual([
      ['ilike', ['name', '%أحمد%']],
      ['eq', ['direction', 'payable']],
      ['eq', ['amount', 50]],
      ['gte', ['transaction_date', '2026-07-01']],
      ['lte', ['transaction_date', '2026-07-31']],
      ['eq', ['currency', 'EGP']],
    ])
  })

  it('escapes ilike wildcards in name filters', () => {
    const ilike = vi.fn(function ilike(this: unknown) {
      return this
    })
    const query = {
      eq() {
        return query
      },
      gte() {
        return query
      },
      lte() {
        return query
      },
      ilike,
    }

    applyTransactionListFilters(query, { name: '100%' })
    expect(ilike).toHaveBeenCalledWith('name', '%100\\%%')
  })
})
