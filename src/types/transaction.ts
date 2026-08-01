import { z } from 'zod'

export const NOTES_MAX_LENGTH = 500

export const transactionDirectionSchema = z.enum(['receivable', 'payable'])

export type TransactionDirection = z.infer<typeof transactionDirectionSchema>

/** Normalizes optional notes: blank → null; otherwise trimmed collapsed whitespace. */
export function normalizeNotes(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > 0 ? trimmed : null
}

export const transactionNotesSchema = z
  .string()
  .max(NOTES_MAX_LENGTH)
  .nullable()
  .transform((value) => normalizeNotes(value))

export const transactionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  direction: transactionDirectionSchema,
  amount: z.number().int().nonnegative(),
  notes: z.string().max(NOTES_MAX_LENGTH).nullable(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.literal('EGP'),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Transaction = z.infer<typeof transactionSchema>

export const DIRECTION_LABELS: Record<TransactionDirection, string> = {
  receivable: 'ليّا',
  payable: 'عليّا',
}
