import { NOTES_MAX_LENGTH, normalizeNotes } from '../../types/transaction'
import { parseDisplayDate } from '../format/date'
import { normalizeDigits } from '../transaction/formValidation'
import { normalizePersonName } from '../transaction/normalizeName'
import { parseDirectionLabel } from './direction'
import type { CsvFieldErrors, ParsedCsvTransaction } from './types'

export type CsvRowInput = {
  name: string
  directionLabel: string
  amount: string
  transactionDate: string
  currency: string
  notes: string
}

export type CsvRowValidation =
  | { ok: true; value: ParsedCsvTransaction }
  | { ok: false; errors: CsvFieldErrors }

function parseNonNegativeWholeAmount(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, message: 'أدخل المبلغ' }
  }

  const normalized = normalizeDigits(trimmed)
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, message: 'المبلغ يجب أن يكون رقمًا صحيحًا' }
  }

  const amount = Number(normalized)
  if (!Number.isInteger(amount) || amount < 0) {
    return { ok: false, message: 'المبلغ لا يمكن أن يكون سالبًا' }
  }

  return { ok: true, value: amount }
}

function parseCurrency(raw: string): { ok: true } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toUpperCase() === 'EGP') {
    return { ok: true }
  }

  return { ok: false, message: 'العملة يجب أن تكون EGP' }
}

/** Validates one CSV preview row and returns a create-ready payload or Arabic field errors. */
export function validateCsvRow(input: CsvRowInput): CsvRowValidation {
  const errors: CsvFieldErrors = {}

  const name = normalizePersonName(input.name)
  if (!name) {
    errors.name = 'أدخل اسم الشخص'
  }

  const direction = parseDirectionLabel(input.directionLabel)
  if (!direction) {
    errors.direction = 'اختر ليّا أو عليّا'
  }

  const amountResult = parseNonNegativeWholeAmount(input.amount)
  if (amountResult.ok === false) {
    errors.amount = amountResult.message
  }

  const notesRaw = input.notes.trim()
  if (notesRaw.length > NOTES_MAX_LENGTH) {
    errors.notes = `الملاحظات يجب ألا تتجاوز ${NOTES_MAX_LENGTH} حرفًا`
  }

  const displayDate = input.transactionDate.trim()
  let isoDate: string | null = null
  if (!displayDate) {
    errors.transactionDate = 'أدخل التاريخ'
  } else {
    isoDate = parseDisplayDate(displayDate)
    if (!isoDate) {
      errors.transactionDate = 'التاريخ يجب أن يكون بالصيغة يوم/شهر/سنة'
    }
  }

  const currencyResult = parseCurrency(input.currency)
  if (currencyResult.ok === false) {
    errors.currency = currencyResult.message
  }

  if (
    Object.keys(errors).length > 0 ||
    !direction ||
    amountResult.ok === false ||
    !isoDate
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      name,
      direction,
      amount: amountResult.value,
      notes: normalizeNotes(input.notes),
      transactionDate: isoDate,
      currency: 'EGP',
    },
  }
}
