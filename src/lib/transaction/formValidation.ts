import { z } from 'zod'
import {
  NOTES_MAX_LENGTH,
  normalizeNotes,
  transactionDirectionSchema,
} from '../../types/transaction'
import { isIsoDate } from '../format/date'
import { normalizePersonName } from './normalizeName'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const WESTERN_DIGITS = '0123456789'

/** Converts Arabic-Indic digits to Western digits; leaves other chars intact. */
export function normalizeDigits(value: string): string {
  return [...value]
    .map((char) => {
      const index = ARABIC_DIGITS.indexOf(char)
      return index >= 0 ? (WESTERN_DIGITS[index] ?? char) : char
    })
    .join('')
}

export type TransactionFormValues = {
  name: string
  direction: 'receivable' | 'payable' | ''
  amount: string
  notes: string
  transactionDate: string
}

export type TransactionFormErrors = Partial<
  Record<keyof TransactionFormValues, string>
>

export type ValidTransactionForm = {
  name: string
  direction: 'receivable' | 'payable'
  amount: number
  notes: string | null
  transaction_date: string
  currency: 'EGP'
}

const amountSchema = z
  .string()
  .trim()
  .min(1, 'أدخل المبلغ')
  .transform((value) => normalizeDigits(value))
  .refine((value) => /^\d+$/.test(value), 'المبلغ يجب أن يكون رقمًا صحيحًا')
  .transform((value) => Number(value))
  .refine(
    (value) => Number.isInteger(value) && value >= 0,
    'المبلغ لا يمكن أن يكون سالبًا',
  )

/**
 * Validates manual entry fields and returns Arabic inline errors or a
 * create/update payload ready for the API.
 */
export function validateTransactionForm(
  values: TransactionFormValues,
):
  | { ok: true; value: ValidTransactionForm }
  | { ok: false; errors: TransactionFormErrors } {
  const errors: TransactionFormErrors = {}

  const name = normalizePersonName(values.name)
  if (!name) {
    errors.name = 'أدخل اسم الشخص'
  }

  const directionParsed = transactionDirectionSchema.safeParse(values.direction)
  if (!directionParsed.success) {
    errors.direction = 'اختر ليّا أو عليّا'
  }

  const amountParsed = amountSchema.safeParse(values.amount)
  if (!amountParsed.success) {
    errors.amount =
      amountParsed.error.issues[0]?.message ?? 'المبلغ غير صالح'
  }

  const notesRaw = values.notes.trim()
  if (notesRaw.length > NOTES_MAX_LENGTH) {
    errors.notes = `الملاحظات يجب ألا تتجاوز ${NOTES_MAX_LENGTH} حرفًا`
  }

  const date = values.transactionDate.trim()
  if (!date) {
    errors.transactionDate = 'أدخل التاريخ'
  } else if (!isIsoDate(date)) {
    errors.transactionDate = 'التاريخ غير صالح'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      name,
      direction: directionParsed.data!,
      amount: amountParsed.data!,
      notes: normalizeNotes(values.notes),
      transaction_date: date,
      currency: 'EGP',
    },
  }
}
