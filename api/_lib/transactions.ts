import type { SupabaseClient } from '@supabase/supabase-js'
import {
  apiTransactionSchema,
  type ApiTransaction,
  type TransactionCreateInput,
  type TransactionListQuery,
  type TransactionUpdateInput,
} from '../../src/types/api.ts'
import { normalizeNotes } from '../../src/types/transaction.ts'
import {
  readMutationReceipt,
  storeMutationReceipt,
} from './mutationReceipts.ts'

const SELECT_COLUMNS =
  'id, name, direction, amount, notes, transaction_date, currency, created_at, updated_at'

/** Collapse whitespace and trim; matches DB insert normalization. */
export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Case-folded key used for person identity and dedupe comparisons. */
export function normalizePersonNameKey(name: string): string {
  return normalizePersonName(name).toLowerCase()
}

function notesDedupeKey(notes: string | null | undefined): string {
  return (normalizeNotes(notes) ?? '').toLowerCase()
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}

export function parseTransactionRow(row: unknown): ApiTransaction {
  return apiTransactionSchema.parse(row)
}

export async function readTransactionById(
  supabase: SupabaseClient,
  id: string,
): Promise<ApiTransaction | null> {
  const { data: transactionRow, error } = await supabase
    .from('transactions')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return transactionRow ? parseTransactionRow(transactionRow) : null
}

function matchesCreateInput(
  transaction: ApiTransaction,
  input: TransactionCreateInput,
): boolean {
  return (
    normalizePersonNameKey(transaction.name) ===
      normalizePersonNameKey(input.name) &&
    transaction.direction === input.direction &&
    transaction.amount === input.amount &&
    notesDedupeKey(transaction.notes) === notesDedupeKey(input.notes) &&
    transaction.transaction_date === input.transaction_date &&
    transaction.currency === input.currency
  )
}

type ListFilterTarget = {
  eq: (column: string, value: string | number) => ListFilterTarget
  gte: (column: string, value: string) => ListFilterTarget
  lte: (column: string, value: string) => ListFilterTarget
  ilike: (column: string, pattern: string) => ListFilterTarget
}

export function applyTransactionListFilters(
  query: ListFilterTarget,
  filters: TransactionListQuery,
): ListFilterTarget {
  let next = query

  if (filters.name !== undefined) {
    const pattern = `%${escapeIlike(normalizePersonName(filters.name))}%`
    next = next.ilike('name', pattern)
  }

  if (filters.direction !== undefined) {
    next = next.eq('direction', filters.direction)
  }

  if (filters.amount !== undefined) {
    next = next.eq('amount', filters.amount)
  }

  if (filters.date_from !== undefined) {
    next = next.gte('transaction_date', filters.date_from)
  }

  if (filters.date_to !== undefined) {
    next = next.lte('transaction_date', filters.date_to)
  }

  if (filters.currency !== undefined) {
    next = next.eq('currency', filters.currency)
  }

  return next
}

export async function listTransactions(
  supabase: SupabaseClient,
  filters: TransactionListQuery,
): Promise<{
  data: ApiTransaction[]
  error: { code?: string; message: string } | null
}> {
  const base = supabase
    .from('transactions')
    .select(SELECT_COLUMNS)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  const filtered = applyTransactionListFilters(
    base as unknown as ListFilterTarget,
    filters,
  )

  const { data: transactionRows, error } = await (filtered as unknown as typeof base)
  if (error) {
    return { data: [], error }
  }

  return {
    data: (transactionRows ?? []).map((row) => parseTransactionRow(row)),
    error: null,
  }
}

export async function createTransaction(
  supabase: SupabaseClient,
  input: TransactionCreateInput,
): Promise<
  | { ok: true; transaction: ApiTransaction; idempotent: boolean }
  | { ok: false; duplicate: true }
  | { ok: false; duplicate: false; message: string }
> {
  if (input.client_mutation_id) {
    const receipt = await readMutationReceipt(supabase, input.client_mutation_id)
    if (receipt?.operation === 'create' && receipt.snapshot) {
      return { ok: true, transaction: receipt.snapshot, idempotent: true }
    }
  }

  const row = {
    ...(input.id === undefined ? {} : { id: input.id }),
    name: normalizePersonName(input.name),
    direction: input.direction,
    amount: input.amount,
    notes: normalizeNotes(input.notes),
    transaction_date: input.transaction_date,
    currency: input.currency,
  }

  const { data: createdTransactionRow, error } = await supabase
    .from('transactions')
    .insert(row)
    .select(SELECT_COLUMNS)
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      if (input.id) {
        const existing = await readTransactionById(supabase, input.id)
        if (existing && matchesCreateInput(existing, input)) {
          return { ok: true, transaction: existing, idempotent: true }
        }
      }
      return { ok: false, duplicate: true }
    }
    return { ok: false, duplicate: false, message: error.message }
  }

  const transaction = parseTransactionRow(createdTransactionRow)
  if (input.client_mutation_id) {
    await storeMutationReceipt(supabase, {
      clientMutationId: input.client_mutation_id,
      operation: 'create',
      transactionId: transaction.id,
      transaction,
      deleted: false,
    })
  }
  return { ok: true, transaction, idempotent: false }
}

export async function updateTransaction(
  supabase: SupabaseClient,
  id: string,
  input: TransactionUpdateInput,
): Promise<
  | { ok: true; transaction: ApiTransaction; idempotent: boolean }
  | { ok: false; notFound: true }
  | { ok: false; duplicate: true; transaction?: ApiTransaction }
  | { ok: false; message: string }
> {
  if (input.client_mutation_id) {
    const receipt = await readMutationReceipt(supabase, input.client_mutation_id)
    if (receipt?.operation === 'update' && receipt.snapshot) {
      return { ok: true, transaction: receipt.snapshot, idempotent: true }
    }
  }

  const patch: Record<string, string | number | null> = {}

  if (input.name !== undefined) {
    patch.name = normalizePersonName(input.name)
  }
  if (input.direction !== undefined) {
    patch.direction = input.direction
  }
  if (input.amount !== undefined) {
    patch.amount = input.amount
  }
  if (input.notes !== undefined) {
    patch.notes = normalizeNotes(input.notes)
  }
  if (input.transaction_date !== undefined) {
    patch.transaction_date = input.transaction_date
  }
  if (input.currency !== undefined) {
    patch.currency = input.currency
  }

  const { data: updatedTransactionRow, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        duplicate: true,
        transaction: await readTransactionById(supabase, id) ?? undefined,
      }
    }
    return { ok: false, message: error.message }
  }

  if (!updatedTransactionRow) {
    return { ok: false, notFound: true }
  }

  const transaction = parseTransactionRow(updatedTransactionRow)
  if (input.client_mutation_id) {
    await storeMutationReceipt(supabase, {
      clientMutationId: input.client_mutation_id,
      operation: 'update',
      transactionId: transaction.id,
      transaction,
      deleted: false,
    })
  }
  return { ok: true, transaction, idempotent: false }
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  id: string,
  clientMutationId?: string,
): Promise<{ ok: true } | { ok: false; notFound: true } | { ok: false; message: string }> {
  if (clientMutationId) {
    const receipt = await readMutationReceipt(supabase, clientMutationId)
    if (receipt?.operation === 'delete' && receipt.deleted) {
      return { ok: true }
    }
  }

  const { data: deletedTransactionRow, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }

  if (!deletedTransactionRow) {
    return { ok: false, notFound: true }
  }

  if (clientMutationId) {
    await storeMutationReceipt(supabase, {
      clientMutationId,
      operation: 'delete',
      transactionId: id,
      transaction: null,
      deleted: true,
    })
  }

  return { ok: true }
}
