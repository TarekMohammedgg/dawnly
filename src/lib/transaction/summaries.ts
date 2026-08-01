import type { Transaction } from '../../types/transaction'

export type DirectionTotals = {
  receivable: number
  payable: number
}

export type PersonSummary = DirectionTotals & {
  name: string
  net: number
}

/** Sums ليّا (receivable) and عليّا (payable) from a transaction set. */
export function summarizeDirections(
  transactions: readonly Transaction[],
): DirectionTotals {
  let receivable = 0
  let payable = 0

  for (const transaction of transactions) {
    if (transaction.direction === 'receivable') {
      receivable += transaction.amount
    } else {
      payable += transaction.amount
    }
  }

  return { receivable, payable }
}

/**
 * Net balance for a person: positive means they owe the user more (ليّا),
 * negative means the user owes them more (عليّا).
 */
export function summarizePerson(
  name: string,
  transactions: readonly Transaction[],
): PersonSummary {
  const totals = summarizeDirections(transactions)
  return {
    name,
    receivable: totals.receivable,
    payable: totals.payable,
    net: totals.receivable - totals.payable,
  }
}

export function uniqueSortedNames(
  transactions: readonly Transaction[],
): string[] {
  const names = new Set<string>()
  for (const transaction of transactions) {
    names.add(transaction.name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ar'))
}
