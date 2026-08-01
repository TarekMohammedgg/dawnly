import type { TransactionDirection } from '../../types/transaction'

export type CsvFieldKey =
  | 'name'
  | 'direction'
  | 'amount'
  | 'transactionDate'
  | 'currency'
  | 'notes'

export type CsvFieldErrors = Partial<Record<CsvFieldKey, string>>

export type CsvRowStatus = 'valid' | 'invalid' | 'duplicate'

export type CsvDuplicateSource = 'csv' | 'existing'

/** Editable preview row shown after parsing a CSV file. */
export type CsvPreviewRow = {
  id: string
  sourceIndex: number
  name: string
  directionLabel: string
  amount: string
  transactionDate: string
  currency: string
  notes: string
  status: CsvRowStatus
  fieldErrors: CsvFieldErrors
  duplicateSource?: CsvDuplicateSource
}

export type CsvPreviewSummary = {
  total: number
  valid: number
  invalid: number
  duplicate: number
}

export type ParsedCsvTransaction = {
  name: string
  direction: TransactionDirection
  amount: number
  notes: string | null
  transactionDate: string
  currency: 'EGP'
}

export type CsvParseFailure = {
  ok: false
  message: string
}

export type CsvParseSuccess = {
  ok: true
  rows: CsvPreviewRow[]
  summary: CsvPreviewSummary
}

export type CsvParseResult = CsvParseFailure | CsvParseSuccess
