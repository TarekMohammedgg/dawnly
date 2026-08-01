import { describe, expect, it } from 'vitest'
import {
  normalizeDigits,
  validateTransactionForm,
} from '../transaction/formValidation'
import { todayIsoDate, parseDisplayDate, formatDisplayDate } from '../format/date'
import {
  summarizeDirections,
  summarizePerson,
  uniqueSortedNames,
} from '../transaction/summaries'
import { normalizePersonName, normalizePersonNameKey } from '../transaction/normalizeName'
import {
  ledgerFiltersToQuery,
  ledgerFiltersToSearchParams,
  parseLedgerFilters,
} from '../routing/ledgerFilters'
import { pathToRouteId, personPath } from '../routing/routes'
import { sampleTransactions } from '../../test/fixtures/transactions'

describe('normalizePersonName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizePersonName('  أحمد   محمد  ')).toBe('أحمد محمد')
    expect(normalizePersonNameKey('أحمد')).toBe(normalizePersonNameKey(' أحمد '))
  })
})

describe('date helpers', () => {
  it('defaults to today as ISO and formats DD/MM/YYYY', () => {
    const iso = todayIsoDate(new Date('2026-08-01T15:00:00'))
    expect(iso).toBe('2026-08-01')
    expect(formatDisplayDate(iso)).toBe('01/08/2026')
    expect(parseDisplayDate('01/08/2026')).toBe('2026-08-01')
    expect(parseDisplayDate('32/08/2026')).toBeNull()
  })
})

describe('validateTransactionForm', () => {
  it('accepts zero amounts and optional notes; rejects decimals and negatives', () => {
    const valid = validateTransactionForm({
      name: ' أحمد ',
      direction: 'receivable',
      amount: '٥٠',
      notes: '',
      transactionDate: '2026-08-01',
    })
    expect(valid).toEqual({
      ok: true,
      value: {
        name: 'أحمد',
        direction: 'receivable',
        amount: 50,
        notes: null,
        transaction_date: '2026-08-01',
        currency: 'EGP',
      },
    })

    expect(
      validateTransactionForm({
        name: 'سارة',
        direction: 'payable',
        amount: '0',
        notes: 'كيس سكر',
        transactionDate: '2026-08-01',
      }),
    ).toEqual({
      ok: true,
      value: {
        name: 'سارة',
        direction: 'payable',
        amount: 0,
        notes: 'كيس سكر',
        transaction_date: '2026-08-01',
        currency: 'EGP',
      },
    })

    expect(
      validateTransactionForm({
        name: '',
        direction: '',
        amount: '',
        notes: '',
        transactionDate: '',
      }).ok,
    ).toBe(false)

    expect(
      validateTransactionForm({
        name: 'سارة',
        direction: 'payable',
        amount: '10.5',
        notes: '',
        transactionDate: '2026-08-01',
      }).ok,
    ).toBe(false)

    expect(normalizeDigits('١٢٣')).toBe('123')
  })
})

describe('summaries', () => {
  it('computes direction totals and person net without merging opposites', () => {
    const totals = summarizeDirections(sampleTransactions)
    expect(totals).toEqual({ receivable: 250, payable: 150 })

    const ahmed = sampleTransactions.filter((row) => row.name === 'أحمد')
    expect(summarizePerson('أحمد', ahmed)).toEqual({
      name: 'أحمد',
      receivable: 250,
      payable: 50,
      net: 200,
    })
    expect(ahmed).toHaveLength(2)
    expect(uniqueSortedNames(sampleTransactions)).toEqual(['أحمد', 'سارة'])
  })
})

describe('ledger filter URL helpers', () => {
  it('round-trips filters through the query string', () => {
    const filters = parseLedgerFilters(
      'name=%D8%A3%D8%AD%D9%85%D8%AF&direction=receivable&amount=250&date_from=2026-07-01&date_to=2026-07-31&currency=EGP',
    )
    expect(filters).toMatchObject({
      name: 'أحمد',
      direction: 'receivable',
      amount: '250',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      currency: 'EGP',
    })

    const params = ledgerFiltersToSearchParams(filters)
    expect(params.get('name')).toBe('أحمد')
    expect(params.get('direction')).toBe('receivable')
    expect(ledgerFiltersToQuery(filters)).toEqual({
      name: 'أحمد',
      direction: 'receivable',
      amount: 250,
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      currency: 'EGP',
    })
  })
})

describe('routes', () => {
  it('maps person route and builds person path', () => {
    expect(pathToRouteId('/person')).toBe('person')
    expect(pathToRouteId('/ledger')).toBe('ledger')
    expect(personPath('أحمد')).toContain('/person?')
    expect(personPath('أحمد')).toContain(encodeURIComponent('أحمد'))
  })
})
