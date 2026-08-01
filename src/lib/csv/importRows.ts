import type { TransactionCreateInput } from '../../types/api'
import { queueCreateTransaction } from '../local/transactions'
import { requestSync } from '../sync/syncWorker'
import type { ParsedCsvTransaction } from './types'

/** Queues local creates for valid CSV rows then flushes the Phase 4 sync worker. */
export async function importParsedTransactions(
  rows: ParsedCsvTransaction[],
  token: string | null,
): Promise<number> {
  let imported = 0

  for (const row of rows) {
    const input: TransactionCreateInput = {
      name: row.name,
      direction: row.direction,
      amount: row.amount,
      notes: row.notes,
      transaction_date: row.transactionDate,
      currency: row.currency,
    }
    await queueCreateTransaction(input)
    imported += 1
  }

  if (token && imported > 0) {
    try {
      await requestSync(token)
    } catch {
      // Local queue already holds the rows; Phase 4 retries when online.
    }
  }

  return imported
}
