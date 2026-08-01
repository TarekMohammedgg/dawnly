import {
  extractTransactionDraftSchema,
  type ExtractTransactionDraft,
} from '../../../src/types/api.js'
import { NOTES_MAX_LENGTH, normalizeNotes } from '../../../src/types/transaction.js'

/**
 * Strips optional markdown fences and parses the model JSON into a draft.
 * Unknown/invalid fields become null; currency is always EGP.
 */
export function parseExtractionContent(raw: string): ExtractTransactionDraft {
  const trimmed = raw.trim()
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(unfenced) as unknown
  } catch {
    throw new Error('invalid_json')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_json')
  }

  const record = parsed as Record<string, unknown>

  const name =
    typeof record.name === 'string' && record.name.trim().length > 0
      ? record.name.trim()
      : null

  const direction =
    record.direction === 'receivable' || record.direction === 'payable'
      ? record.direction
      : null

  let amount: number | null = null
  if (
    typeof record.amount === 'number' &&
    Number.isInteger(record.amount) &&
    record.amount >= 0
  ) {
    amount = record.amount
  } else if (typeof record.amount === 'string' && /^\d+$/.test(record.amount.trim())) {
    const n = Number(record.amount.trim())
    if (n >= 0) {
      amount = n
    }
  }

  let notes: string | null = null
  if (typeof record.notes === 'string') {
    const normalized = normalizeNotes(record.notes)
    if (normalized && normalized.length <= NOTES_MAX_LENGTH) {
      notes = normalized
    }
  }

  const dateRaw =
    typeof record.transaction_date === 'string' ? record.transaction_date.trim() : null
  const transaction_date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null

  return extractTransactionDraftSchema.parse({
    name,
    direction,
    amount,
    notes,
    transaction_date,
    currency: 'EGP',
  })
}
