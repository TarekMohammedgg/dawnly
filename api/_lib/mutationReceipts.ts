import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { apiTransactionSchema, type ApiTransaction } from '../../src/types/api.js'

const mutationReceiptSchema = z.object({
  client_mutation_id: z.string().uuid(),
  operation: z.enum(['create', 'update', 'delete']),
  transaction_id: z.string().uuid(),
  snapshot: apiTransactionSchema.nullable(),
  deleted: z.boolean(),
})

export type MutationReceipt = z.infer<typeof mutationReceiptSchema>

export async function readMutationReceipt(
  supabase: SupabaseClient,
  clientMutationId: string,
): Promise<MutationReceipt | null> {
  const { data: receiptRow, error } = await supabase
    .from('transaction_mutation_receipts')
    .select('client_mutation_id, operation, transaction_id, snapshot, deleted')
    .eq('client_mutation_id', clientMutationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return receiptRow ? mutationReceiptSchema.parse(receiptRow) : null
}

export async function storeMutationReceipt(
  supabase: SupabaseClient,
  receipt: {
    clientMutationId: string
    operation: MutationReceipt['operation']
    transactionId: string
    transaction: ApiTransaction | null
    deleted: boolean
  },
): Promise<void> {
  const { error } = await supabase.from('transaction_mutation_receipts').insert({
    client_mutation_id: receipt.clientMutationId,
    operation: receipt.operation,
    transaction_id: receipt.transactionId,
    snapshot: receipt.transaction,
    deleted: receipt.deleted,
  })

  if (error && error.code !== '23505') {
    throw new Error(error.message)
  }
}
