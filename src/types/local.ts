import { z } from 'zod'
import { transactionCreateSchema } from './api'
import {
  transactionDirectionSchema,
  transactionSchema,
} from './transaction'

const localCreatePayloadSchema = transactionCreateSchema.omit({
  id: true,
  client_mutation_id: true,
})

export type LocalCreatePayload = z.infer<typeof localCreatePayloadSchema>

const localUpdatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    direction: transactionDirectionSchema.optional(),
    amount: z.number().int().nonnegative().optional(),
    notes: z.string().max(500).nullable().optional(),
    transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currency: z.literal('EGP').optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((field) => field !== undefined),
    { message: 'At least one field is required' },
  )

export type LocalUpdatePayload = z.infer<typeof localUpdatePayloadSchema>

const localMutationMetadataSchema = z.object({
  transactionId: z.string().uuid(),
  clientMutationId: z.string().uuid(),
  attemptCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastError: z.string().nullable(),
})

export const localSyncStateSchema = z.enum(['synced', 'pending'])

export const localTransactionSchema = transactionSchema.extend({
  syncState: localSyncStateSchema,
})

export type LocalTransaction = z.infer<typeof localTransactionSchema>

export const pendingMutationSchema = z.discriminatedUnion('operation', [
  localMutationMetadataSchema.extend({
    operation: z.literal('create'),
    payload: localCreatePayloadSchema,
  }),
  localMutationMetadataSchema.extend({
    operation: z.literal('update'),
    payload: localUpdatePayloadSchema,
  }),
  localMutationMetadataSchema.extend({
    operation: z.literal('delete'),
    payload: z.null(),
  }),
])

export type PendingMutation = z.infer<typeof pendingMutationSchema>

export type StoredLocalTransaction = {
  id: string
  encryptedPayload: string
  updatedAt: string
  syncState: LocalTransaction['syncState']
}

export type StoredPendingMutation = {
  clientMutationId: string
  transactionId: string
  operation: PendingMutation['operation']
  attemptCount: number
  createdAt: string
  updatedAt: string
  lastError: string | null
  encryptedPayload: string
}

export type LocalMetadata = {
  key: string
  value: string
  updatedAt: string
}
