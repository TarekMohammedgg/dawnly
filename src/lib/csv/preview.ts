import type { Transaction } from '../../types/transaction'
import { CSV_HEADERS } from './constants'
import { transactionDuplicateKey } from './duplicateKey'
import type { RawCsvRecord } from './parseCsvFile'
import type {
  CsvParseResult,
  CsvPreviewRow,
  CsvPreviewSummary,
  ParsedCsvTransaction,
} from './types'
import { validateCsvRow } from './validateCsvRow'

function newPreviewId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function summarize(rows: CsvPreviewRow[]): CsvPreviewSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === 'valid').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    duplicate: rows.filter((row) => row.status === 'duplicate').length,
  }
}

function existingDuplicateKeys(existing: Transaction[]): Set<string> {
  return new Set(
    existing.map((transaction) =>
      transactionDuplicateKey(
        transaction.name,
        transaction.direction,
        transaction.amount,
        transaction.transactionDate,
        transaction.notes,
      ),
    ),
  )
}

function toPreviewFields(record: RawCsvRecord) {
  return {
    name: record[CSV_HEADERS.name] ?? '',
    directionLabel: record[CSV_HEADERS.direction] ?? '',
    amount: record[CSV_HEADERS.amount] ?? '',
    transactionDate: record[CSV_HEADERS.date] ?? '',
    currency: record[CSV_HEADERS.currency] ?? '',
    notes: record[CSV_HEADERS.notes] ?? '',
  }
}

function buildPreviewRow(
  fields: ReturnType<typeof toPreviewFields>,
  sourceIndex: number,
  id: string,
): CsvPreviewRow {
  const validation = validateCsvRow(fields)
  if (validation.ok === false) {
    return {
      id,
      sourceIndex,
      ...fields,
      status: 'invalid',
      fieldErrors: validation.errors,
    }
  }

  return {
    id,
    sourceIndex,
    ...fields,
    currency: fields.currency.trim() === '' ? 'EGP' : fields.currency,
    status: 'valid',
    fieldErrors: {},
  }
}

/**
 * Marks in-file and existing-data duplicates among otherwise valid rows.
 * First occurrence of a key stays valid; later ones become duplicates.
 */
export function applyDuplicateFlags(
  rows: CsvPreviewRow[],
  existing: Transaction[],
): CsvPreviewRow[] {
  const seenInFile = new Set<string>()
  const existingKeys = existingDuplicateKeys(existing)

  return rows.map((row) => {
    if (row.status === 'invalid') {
      return row
    }

    const validation = validateCsvRow({
      name: row.name,
      directionLabel: row.directionLabel,
      amount: row.amount,
      transactionDate: row.transactionDate,
      currency: row.currency,
      notes: row.notes,
    })
    if (validation.ok === false) {
      return {
        ...row,
        status: 'invalid',
        fieldErrors: validation.errors,
        duplicateSource: undefined,
      }
    }

    const key = transactionDuplicateKey(
      validation.value.name,
      validation.value.direction,
      validation.value.amount,
      validation.value.transactionDate,
      validation.value.notes,
    )

    if (existingKeys.has(key)) {
      return {
        ...row,
        status: 'duplicate',
        fieldErrors: {},
        duplicateSource: 'existing',
      }
    }

    if (seenInFile.has(key)) {
      return {
        ...row,
        status: 'duplicate',
        fieldErrors: {},
        duplicateSource: 'csv',
      }
    }

    seenInFile.add(key)
    return {
      ...row,
      status: 'valid',
      fieldErrors: {},
      duplicateSource: undefined,
    }
  })
}

/** Builds editable preview rows from parsed CSV records. */
export function buildPreviewFromRecords(
  records: RawCsvRecord[],
  existing: Transaction[],
): CsvParseResult {
  const draftRows = records.map((record, index) =>
    buildPreviewRow(toPreviewFields(record), index + 2, newPreviewId()),
  )
  const rows = applyDuplicateFlags(draftRows, existing)
  return { ok: true, rows, summary: summarize(rows) }
}

/** Re-validates edited preview rows and refreshes duplicate/status summary. */
export function refreshPreviewRows(
  rows: CsvPreviewRow[],
  existing: Transaction[],
): { rows: CsvPreviewRow[]; summary: CsvPreviewSummary } {
  const revalidated = rows.map((row) =>
    buildPreviewRow(
      {
        name: row.name,
        directionLabel: row.directionLabel,
        amount: row.amount,
        transactionDate: row.transactionDate,
        currency: row.currency,
        notes: row.notes,
      },
      row.sourceIndex,
      row.id,
    ),
  )
  const withDuplicates = applyDuplicateFlags(revalidated, existing)
  return { rows: withDuplicates, summary: summarize(withDuplicates) }
}

/** Collects create-ready payloads for rows currently marked valid. */
export function collectValidImportPayloads(
  rows: CsvPreviewRow[],
): ParsedCsvTransaction[] {
  const payloads: ParsedCsvTransaction[] = []
  for (const row of rows) {
    if (row.status !== 'valid') {
      continue
    }
    const validation = validateCsvRow({
      name: row.name,
      directionLabel: row.directionLabel,
      amount: row.amount,
      transactionDate: row.transactionDate,
      currency: row.currency,
      notes: row.notes,
    })
    if (validation.ok) {
      payloads.push(validation.value)
    }
  }
  return payloads
}
