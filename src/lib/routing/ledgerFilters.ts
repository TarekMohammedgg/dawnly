import type { TransactionListQuery } from '../../types/api'
import type { TransactionDirection } from '../../types/transaction'

export type LedgerFilters = {
  name: string
  direction: TransactionDirection | ''
  amount: string
  dateFrom: string
  dateTo: string
  currency: 'EGP' | ''
}

export const EMPTY_LEDGER_FILTERS: LedgerFilters = {
  name: '',
  direction: '',
  amount: '',
  dateFrom: '',
  dateTo: '',
  currency: 'EGP',
}

export function parseLedgerFilters(search: string): LedgerFilters {
  const params = new URLSearchParams(search)
  const direction = params.get('direction')
  const currency = params.get('currency')

  return {
    name: params.get('name') ?? '',
    direction:
      direction === 'receivable' || direction === 'payable' ? direction : '',
    amount: params.get('amount') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
    currency: currency === 'EGP' ? 'EGP' : currency === '' ? '' : 'EGP',
  }
}

export function ledgerFiltersToSearchParams(
  filters: LedgerFilters,
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.name.trim()) {
    params.set('name', filters.name.trim())
  }
  if (filters.direction) {
    params.set('direction', filters.direction)
  }
  if (filters.amount.trim()) {
    params.set('amount', filters.amount.trim())
  }
  if (filters.dateFrom) {
    params.set('date_from', filters.dateFrom)
  }
  if (filters.dateTo) {
    params.set('date_to', filters.dateTo)
  }
  if (filters.currency) {
    params.set('currency', filters.currency)
  }
  return params
}

export function ledgerFiltersToQuery(
  filters: LedgerFilters,
): TransactionListQuery {
  const amountValue = filters.amount.trim()
  const amount = amountValue ? Number(amountValue) : undefined

  return {
    ...(filters.name.trim() ? { name: filters.name.trim() } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(amount !== undefined && Number.isInteger(amount) && amount >= 0
      ? { amount }
      : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
  }
}
