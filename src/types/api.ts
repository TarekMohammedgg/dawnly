import { z } from 'zod'
import {
  normalizeNotes,
  NOTES_MAX_LENGTH,
  transactionDirectionSchema,
  transactionSchema,
} from './transaction.ts'

const optionalNotesInputSchema = z
  .union([z.string().max(NOTES_MAX_LENGTH), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : normalizeNotes(value)))

/** Wire format matches Supabase column names. */
export const apiTransactionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  direction: transactionDirectionSchema,
  amount: z.number().int().nonnegative(),
  notes: z.preprocess(
    (value) => (value === undefined || value === '' ? null : value),
    z.string().max(NOTES_MAX_LENGTH).nullable(),
  ),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.literal('EGP'),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ApiTransaction = z.infer<typeof apiTransactionSchema>

export const transactionCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  direction: transactionDirectionSchema,
  amount: z.number().int().nonnegative(),
  notes: z
    .union([z.string().max(NOTES_MAX_LENGTH), z.null()])
    .optional()
    .transform((value) => normalizeNotes(value ?? null)),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.literal('EGP').default('EGP'),
  client_mutation_id: z.string().uuid().optional(),
})

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>

export const transactionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    direction: transactionDirectionSchema.optional(),
    amount: z.number().int().nonnegative().optional(),
    notes: optionalNotesInputSchema,
    transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    currency: z.literal('EGP').optional(),
    client_mutation_id: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.direction !== undefined ||
      value.amount !== undefined ||
      value.notes !== undefined ||
      value.transaction_date !== undefined ||
      value.currency !== undefined,
    { message: 'At least one field is required' },
  )

export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

export const transactionDeleteSchema = z.object({
  client_mutation_id: z.string().uuid().optional(),
})

export type TransactionDeleteInput = z.infer<typeof transactionDeleteSchema>

export const transactionListQuerySchema = z.object({
  name: z.string().trim().min(1).optional(),
  direction: transactionDirectionSchema.optional(),
  amount: z.coerce.number().int().nonnegative().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.literal('EGP').optional(),
})

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>

export const apiErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'duplicate',
  'conflict',
  'locked',
  'invalid_pin',
  'rate_limited',
  'internal_error',
])

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorResponse = z.infer<typeof apiErrorSchema>

export const verifyPinRequestSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{6}$/, 'PIN must be exactly six ASCII digits'),
})

export type VerifyPinRequest = z.infer<typeof verifyPinRequestSchema>

export const verifyPinSuccessSchema = z.object({
  token: z.string().min(1),
  expires_at: z.string().datetime(),
})

export type VerifyPinSuccess = z.infer<typeof verifyPinSuccessSchema>

export const aiProviderSchema = z.enum(['openrouter', 'minimax'])

export type AiProvider = z.infer<typeof aiProviderSchema>

export const aiProviderKeyStatusSchema = z.object({
  configured: z.boolean(),
  updated_at: z.string().nullable().optional(),
})

export type AiProviderKeyStatus = z.infer<typeof aiProviderKeyStatusSchema>

export const aiKeyStatusSchema = z.object({
  provider: aiProviderSchema,
  openrouter: aiProviderKeyStatusSchema,
  minimax: aiProviderKeyStatusSchema,
})

export type AiKeyStatus = z.infer<typeof aiKeyStatusSchema>

export const aiKeyUpdateRequestSchema = z.object({
  provider: aiProviderSchema,
  api_key: z.string().trim().min(8).max(512).optional(),
})

export type AiKeyUpdateRequest = z.infer<typeof aiKeyUpdateRequestSchema>

/** Max transcript length accepted by voice field extraction. */
export const EXTRACT_TRANSCRIPT_MAX_LENGTH = 1000

export const extractTransactionRequestSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(1, 'أدخل نص التسجيل')
    .max(EXTRACT_TRANSCRIPT_MAX_LENGTH, 'نص التسجيل طويل جداً'),
})

export type ExtractTransactionRequest = z.infer<
  typeof extractTransactionRequestSchema
>

/**
 * Draft fields from AI extraction. Null means the model could not determine
 * the value; the review screen leaves those inputs blank for the user.
 */
export const extractTransactionDraftSchema = z.object({
  name: z.string().trim().min(1).nullable(),
  direction: transactionDirectionSchema.nullable(),
  amount: z.number().int().nonnegative().nullable(),
  notes: z.string().max(NOTES_MAX_LENGTH).nullable(),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  currency: z.literal('EGP'),
})

export type ExtractTransactionDraft = z.infer<
  typeof extractTransactionDraftSchema
>

export const extractTransactionResponseSchema = z.object({
  transcript: z.string().min(1),
  draft: extractTransactionDraftSchema,
  confidence: z.number().min(0).max(1).nullable().optional(),
})

export type ExtractTransactionResponse = z.infer<
  typeof extractTransactionResponseSchema
>

export const transactionListResponseSchema = z.object({
  transactions: z.array(apiTransactionSchema),
})

export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>

export const transactionMutationResponseSchema = z.object({
  transaction: apiTransactionSchema,
})

export type TransactionMutationResponse = z.infer<
  typeof transactionMutationResponseSchema
>

/** Maps API/DB rows into the client Transaction shape. */
export function toClientTransaction(row: ApiTransaction) {
  return transactionSchema.parse({
    id: row.id,
    name: row.name,
    direction: row.direction,
    amount: row.amount,
    notes: row.notes ?? null,
    transactionDate: row.transaction_date,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}
