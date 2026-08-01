import type { TransactionDirection } from '../../types/transaction'
import { normalizeNotes } from '../../types/transaction'
import { normalizePersonNameKey } from '../transaction/normalizeName'

/** Stable key for duplicate detection: name + direction + amount + date + notes. */
export function transactionDuplicateKey(
  name: string,
  direction: TransactionDirection,
  amount: number,
  transactionDate: string,
  notes: string | null = null,
): string {
  const notesKey = (normalizeNotes(notes) ?? '').toLowerCase()
  return `${normalizePersonNameKey(name)}|${direction}|${amount}|${transactionDate}|${notesKey}`
}
