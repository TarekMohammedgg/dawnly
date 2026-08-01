import type {
  TransactionCreateInput,
  TransactionListQuery,
  TransactionUpdateInput,
} from '../../types/api'
import type { Transaction } from '../../types/transaction'
import {
  localTransactionSchema,
  pendingMutationSchema,
  type LocalCreatePayload,
  type LocalTransaction,
  type LocalUpdatePayload,
  type PendingMutation,
} from '../../types/local'
import { normalizePersonName, normalizePersonNameKey } from '../transaction/normalizeName'
import { dawnlyDb } from './database'
import { notifyLocalDataChanged } from './status'

function nowIso(): string {
  return new Date().toISOString()
}

let lastMutationTimestamp = 0

function nextMutationTimestamp(): string {
  const currentTimestamp = Date.now()
  lastMutationTimestamp = Math.max(currentTimestamp, lastMutationTimestamp + 1)
  return new Date(lastMutationTimestamp).toISOString()
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const randomBytes = new Uint8Array(16)
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('تعذر إنشاء معرف محلي آمن')
  }
  globalThis.crypto.getRandomValues(randomBytes)
  randomBytes[6] = (randomBytes[6]! & 0x0f) | 0x40
  randomBytes[8] = (randomBytes[8]! & 0x3f) | 0x80
  const hex = [...randomBytes].map((byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

function toLocalTransaction(
  transaction: Transaction,
  syncState: LocalTransaction['syncState'] = 'synced',
): LocalTransaction {
  return localTransactionSchema.parse({
    ...transaction,
    syncState,
  })
}

function toClientTransaction(localTransaction: LocalTransaction): Transaction {
  return {
    id: localTransaction.id,
    name: localTransaction.name,
    direction: localTransaction.direction,
    amount: localTransaction.amount,
    notes: localTransaction.notes ?? null,
    transactionDate: localTransaction.transactionDate,
    currency: localTransaction.currency,
    createdAt: localTransaction.createdAt,
    updatedAt: localTransaction.updatedAt,
  }
}

function matchesFilters(
  transaction: Transaction,
  filters: TransactionListQuery,
): boolean {
  const normalizedFilterName = filters.name
    ? normalizePersonNameKey(filters.name)
    : null
  const normalizedName = normalizePersonNameKey(transaction.name)

  return (
    (!normalizedFilterName || normalizedName.includes(normalizedFilterName)) &&
    (!filters.direction || transaction.direction === filters.direction) &&
    (filters.amount === undefined || transaction.amount === filters.amount) &&
    (!filters.date_from || transaction.transactionDate >= filters.date_from) &&
    (!filters.date_to || transaction.transactionDate <= filters.date_to) &&
    (!filters.currency || transaction.currency === filters.currency)
  )
}

function sortNewestFirst(
  firstTransaction: Transaction,
  secondTransaction: Transaction,
): number {
  const dateOrder = secondTransaction.transactionDate.localeCompare(
    firstTransaction.transactionDate,
  )
  return dateOrder || secondTransaction.createdAt.localeCompare(firstTransaction.createdAt)
}

function isUnfiltered(filters: TransactionListQuery): boolean {
  return Object.values(filters).every((filter) => filter === undefined)
}

function toCreatePayload(input: TransactionCreateInput): LocalCreatePayload {
  return {
    name: normalizePersonName(input.name),
    direction: input.direction,
    amount: input.amount,
    notes: input.notes ?? null,
    transaction_date: input.transaction_date,
    currency: input.currency,
  }
}

function toUpdatePayload(input: TransactionUpdateInput): LocalUpdatePayload {
  return {
    ...(input.name === undefined ? {} : { name: normalizePersonName(input.name) }),
    ...(input.direction === undefined ? {} : { direction: input.direction }),
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.transaction_date === undefined
      ? {}
      : { transaction_date: input.transaction_date }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
  }
}

function createMutationMetadata(transactionId: string, clientMutationId: string) {
  const timestamp = nextMutationTimestamp()
  return {
    transactionId,
    clientMutationId,
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastError: null,
  }
}

function applyUpdate(
  transaction: LocalTransaction,
  payload: LocalUpdatePayload,
): LocalTransaction {
  return toLocalTransaction(
    {
      ...toClientTransaction(transaction),
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.direction === undefined ? {} : { direction: payload.direction }),
      ...(payload.amount === undefined ? {} : { amount: payload.amount }),
      ...(payload.notes === undefined ? {} : { notes: payload.notes }),
      ...(payload.transaction_date === undefined
        ? {}
        : { transactionDate: payload.transaction_date }),
      ...(payload.currency === undefined ? {} : { currency: payload.currency }),
      updatedAt: nowIso(),
    },
    'pending',
  )
}

export async function readCachedTransactions(
  filters: TransactionListQuery = {},
): Promise<Transaction[]> {
  const localRows = await dawnlyDb.transactions.toArray()
  return localRows
    .map(toClientTransaction)
    .filter((transaction) => matchesFilters(transaction, filters))
    .sort(sortNewestFirst)
}

export async function cacheServerTransactions(
  serverRows: Transaction[],
  filters: TransactionListQuery,
): Promise<void> {
  const pendingMutations = await dawnlyDb.pendingMutations.toArray()
  const protectedIds = new Set(
    pendingMutations.map((mutation) => mutation.transactionId),
  )
  const cacheRows = serverRows
    .filter((transaction) => !protectedIds.has(transaction.id))
    .map((transaction) => toLocalTransaction(transaction))

  await dawnlyDb.transaction('rw', dawnlyDb.transactions, async () => {
    await dawnlyDb.transactions.bulkPut(cacheRows)
    if (isUnfiltered(filters)) {
      const returnedIds = new Set(serverRows.map((transaction) => transaction.id))
      const localRows = await dawnlyDb.transactions.toArray()
      const staleIds = localRows
        .filter(
          (localRow) =>
            !returnedIds.has(localRow.id) && !protectedIds.has(localRow.id),
        )
        .map((localRow) => localRow.id)
      await dawnlyDb.transactions.bulkDelete(staleIds)
    }
  })
  notifyLocalDataChanged()
}

export async function queueCreateTransaction(
  input: TransactionCreateInput,
): Promise<{ transaction: Transaction; mutation: PendingMutation }> {
  const transactionId = input.id ?? newUuid()
  const clientMutationId = input.client_mutation_id ?? newUuid()
  const timestamp = nowIso()
  const payload = toCreatePayload(input)
  const transaction = toLocalTransaction(
    {
      id: transactionId,
      name: payload.name,
      direction: payload.direction,
      amount: payload.amount,
      notes: payload.notes ?? null,
      transactionDate: payload.transaction_date,
      currency: payload.currency,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    'pending',
  )
  const mutation = pendingMutationSchema.parse({
    operation: 'create',
    ...createMutationMetadata(transactionId, clientMutationId),
    payload,
  })

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.put(transaction)
      await dawnlyDb.pendingMutations.put(mutation)
    },
  )
  notifyLocalDataChanged()
  return { transaction: toClientTransaction(transaction), mutation }
}

export async function queueUpdateTransaction(
  transactionId: string,
  input: TransactionUpdateInput,
): Promise<{ transaction: Transaction; mutation: PendingMutation }> {
  const currentTransaction = await dawnlyDb.transactions.get(transactionId)
  if (!currentTransaction) {
    throw new Error('لا توجد نسخة محلية من المعاملة')
  }

  const clientMutationId = input.client_mutation_id ?? newUuid()
  const payload = toUpdatePayload(input)
  const transaction = applyUpdate(currentTransaction, payload)
  const mutation = pendingMutationSchema.parse({
    operation: 'update',
    ...createMutationMetadata(transactionId, clientMutationId),
    payload,
  })

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.put(transaction)
      await dawnlyDb.pendingMutations.put(mutation)
    },
  )
  notifyLocalDataChanged()
  return { transaction: toClientTransaction(transaction), mutation }
}

export async function queueDeleteTransaction(
  transactionId: string,
  clientMutationId = newUuid(),
): Promise<PendingMutation> {
  const mutation = pendingMutationSchema.parse({
    operation: 'delete',
    ...createMutationMetadata(transactionId, clientMutationId),
    payload: null,
  })

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.delete(transactionId)
      await dawnlyDb.pendingMutations.put(mutation)
    },
  )
  notifyLocalDataChanged()
  return mutation
}

export async function readNextPendingMutation(): Promise<PendingMutation | null> {
  const pendingMutations = await dawnlyDb.pendingMutations.toArray()
  const nextMutation = pendingMutations.sort((firstMutation, secondMutation) =>
    firstMutation.createdAt.localeCompare(secondMutation.createdAt),
  )[0]
  return nextMutation ? pendingMutationSchema.parse(nextMutation) : null
}

export async function markMutationAttempt(
  mutation: PendingMutation,
): Promise<PendingMutation> {
  const attemptedMutation = pendingMutationSchema.parse({
    ...mutation,
    attemptCount: mutation.attemptCount + 1,
    updatedAt: nowIso(),
    lastError: null,
  })
  await dawnlyDb.pendingMutations.put(attemptedMutation)
  return attemptedMutation
}

export async function markMutationError(
  mutationId: string,
  message: string,
): Promise<void> {
  const mutation = await dawnlyDb.pendingMutations.get(mutationId)
  if (!mutation) {
    return
  }
  await dawnlyDb.pendingMutations.put(
    pendingMutationSchema.parse({
      ...mutation,
      updatedAt: nowIso(),
      lastError: message,
    }),
  )
  notifyLocalDataChanged()
}

export async function removePendingMutation(mutationId: string): Promise<void> {
  await dawnlyDb.pendingMutations.delete(mutationId)
  notifyLocalDataChanged()
}

export async function removeMutationsForTransaction(
  transactionId: string,
): Promise<void> {
  await dawnlyDb.pendingMutations.where('transactionId').equals(transactionId).delete()
  notifyLocalDataChanged()
}

export async function markLocalTransactionSynced(
  transaction: Transaction,
): Promise<void> {
  await dawnlyDb.transactions.put(toLocalTransaction(transaction))
  notifyLocalDataChanged()
}

export async function removeLocalTransaction(transactionId: string): Promise<void> {
  await dawnlyDb.transactions.delete(transactionId)
  notifyLocalDataChanged()
}
