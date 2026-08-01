import Papa from 'papaparse'
import type { Transaction } from '../../types/transaction'
import {
  CSV_EXPORT_HEADERS,
  CSV_HEADERS,
  CSV_SEPARATOR,
  CSV_UTF8_BOM,
} from './constants'
import { directionToLabel } from './direction'
import { formatDisplayDate } from '../format/date'

function sortNewestFirst(
  first: Transaction,
  second: Transaction,
): number {
  const dateOrder = second.transactionDate.localeCompare(first.transactionDate)
  return dateOrder || second.createdAt.localeCompare(first.createdAt)
}

/** Builds a UTF-8 BOM CSV string with Arabic headers, newest-first rows. */
export function buildTransactionsCsv(transactions: Transaction[]): string {
  const ordered = [...transactions].sort(sortNewestFirst)
  const data = ordered.map((transaction) => ({
    [CSV_HEADERS.name]: transaction.name,
    [CSV_HEADERS.direction]: directionToLabel(transaction.direction),
    [CSV_HEADERS.amount]: String(transaction.amount),
    [CSV_HEADERS.date]: formatDisplayDate(transaction.transactionDate),
    [CSV_HEADERS.currency]: 'EGP',
    [CSV_HEADERS.notes]: transaction.notes ?? '',
  }))

  const body = Papa.unparse(
    {
      fields: [...CSV_EXPORT_HEADERS],
      data: data.map((row) => CSV_EXPORT_HEADERS.map((header) => row[header])),
    },
    {
      delimiter: CSV_SEPARATOR,
      newline: '\n',
    },
  )

  return `${CSV_UTF8_BOM}${body}`
}

/** Triggers a browser download of a CSV string. */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
