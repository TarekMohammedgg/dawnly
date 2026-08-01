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
  type StoredLocalTransaction,
  type StoredPendingMutation,
} from '../../types/local'
import { normalizePersonName, normalizePersonNameKey } from '../transaction/normalizeName'
import { dawnlyDb } from './database'
import { decryptLocalJson, encryptLocalJson } from './encryption'
import { notifyLocalDataChanged } from './status'

type TransactionRecord = StoredLocalTransaction | LocalTransaction
type MutationRecord = StoredPendingMutation | PendingMutation

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

function isEncryptedTransaction(
  record: TransactionRecord,
): record is StoredLocalTransaction {
  return 'encryptedPayload' in record
}

function isEncryptedMutation(record: MutationRecord): record is StoredPendingMutation {
  return 'encryptedPayload' in record
}

async function readTransactionRecord(
  record: TransactionRecord,
): Promise<LocalTransaction> {
  if (isEncryptedTransaction(record)) {
    return localTransactionSchema.parse(
      await decryptLocalJson<LocalTransaction>(record.encryptedPayload),
    )
  }
  return localTransactionSchema.parse(record)
}

async function readMutationRecord(
  record: MutationRecord,
): Promise<PendingMutation> {
  if (isEncryptedMutation(record)) {
    return pendingMutationSchema.parse(
      await decryptLocalJson<PendingMutation>(record.encryptedPayload),
    )
  }
  return pendingMutationSchema.parse(record)
}

async function storeTransactionRecord(
  transaction: LocalTransaction,
): Promise<StoredLocalTransaction> {
  return {
    id: transaction.id,
    encryptedPayload: await encryptLocalJson(transaction),
    updatedAt: transaction.updatedAt,
    syncState: transaction.syncState,
  }
}

async function storeMutationRecord(
  mutation: PendingMutation,
): Promise<StoredPendingMutation> {
  return {
    clientMutationId: mutation.clientMutationId,
    transactionId: mutation.transactionId,
    operation: mutation.operation,
    attemptCount: mutation.attemptCount,
    createdAt: mutation.createdAt,
    updatedAt: mutation.updatedAt,
    lastError: mutation.lastError,
    encryptedPayload: await encryptLocalJson(mutation),
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
    currency: input.currency ?? 'EGP',
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

async function readLocalRecords(): Promise<{
  transactions: TransactionRecord[]
  mutations: MutationRecord[]
}> {
  const [transactions, mutations] = await Promise.all([
    dawnlyDb.transactions.toArray(),
    dawnlyDb.pendingMutations.toArray(),
  ])
  return {
    transactions: transactions as TransactionRecord[],
    mutations: mutations as MutationRecord[],
  }
}

async function encryptLegacyTransactions(
  records: TransactionRecord[],
): Promise<StoredLocalTransaction[]> {
  return Promise.all(
    records
      .filter((record) => !isEncryptedTransaction(record))
      .map(async (record) =>
        storeTransactionRecord(await readTransactionRecord(record)),
      ),
  )
}

async function encryptLegacyMutations(
  records: MutationRecord[],
): Promise<StoredPendingMutation[]> {
  return Promise.all(
    records
      .filter((record) => !isEncryptedMutation(record))
      .map(async (record) => storeMutationRecord(await readMutationRecord(record))),
  )
}

async function writeEncryptedLocalData(
  transactions: StoredLocalTransaction[],
  mutations: StoredPendingMutation[],
): Promise<void> {
  if (transactions.length === 0 && mutations.length === 0) {
    return
  }

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.bulkPut(transactions)
      await dawnlyDb.pendingMutations.bulkPut(mutations)
    },
  )
}

export async function migrateLegacyLocalData(): Promise<void> {
  const records = await readLocalRecords()
  const [encryptedTransactions, encryptedMutations] = await Promise.all([
    encryptLegacyTransactions(records.transactions),
    encryptLegacyMutations(records.mutations),
  ])
  await writeEncryptedLocalData(encryptedTransactions, encryptedMutations)
}

export async function readCachedTransactions(
  filters: TransactionListQuery = {},
): Promise<Transaction[]> {
  const localRows = await dawnlyDb.transactions.toArray()
  const localTransactions = await Promise.all(
    (localRows as TransactionRecord[]).map(readTransactionRecord),
  )
  return localTransactions
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
  const cacheRows = await Promise.all(
    serverRows
      .filter((transaction) => !protectedIds.has(transaction.id))
      .map((transaction) =>
        storeTransactionRecord(toLocalTransaction(transaction)),
      ),
  )

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
  const storedTransaction = await storeTransactionRecord(transaction)
  const storedMutation = await storeMutationRecord(mutation)

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.put(storedTransaction)
      await dawnlyDb.pendingMutations.put(storedMutation)
    },
  )
  notifyLocalDataChanged()
  return { transaction: toClientTransaction(transaction), mutation }
}

export async function queueUpdateTransaction(
  transactionId: string,
  input: TransactionUpdateInput,
): Promise<{ transaction: Transaction; mutation: PendingMutation }> {
  const storedCurrentTransaction = await dawnlyDb.transactions.get(transactionId)
  if (!storedCurrentTransaction) {
    throw new Error('لا توجد نسخة محلية من المعاملة')
  }

  const currentTransaction = await readTransactionRecord(storedCurrentTransaction)
  const clientMutationId = input.client_mutation_id ?? newUuid()
  const payload = toUpdatePayload(input)
  const transaction = applyUpdate(currentTransaction, payload)
  const mutation = pendingMutationSchema.parse({
    operation: 'update',
    ...createMutationMetadata(transactionId, clientMutationId),
    payload,
  })
  const storedTransaction = await storeTransactionRecord(transaction)
  const storedMutation = await storeMutationRecord(mutation)

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.put(storedTransaction)
      await dawnlyDb.pendingMutations.put(storedMutation)
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
  const storedMutation = await storeMutationRecord(mutation)

  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    async () => {
      await dawnlyDb.transactions.delete(transactionId)
      await dawnlyDb.pendingMutations.put(storedMutation)
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
  return nextMutation ? readMutationRecord(nextMutation) : null
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
  await dawnlyDb.pendingMutations.put(await storeMutationRecord(attemptedMutation))
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
  const currentMutation = await readMutationRecord(mutation)
  const failedMutation = pendingMutationSchema.parse({
    ...currentMutation,
    updatedAt: nowIso(),
    lastError: message,
  })
  await dawnlyDb.pendingMutations.put(await storeMutationRecord(failedMutation))
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
  await dawnlyDb.transactions.put(
    await storeTransactionRecord(toLocalTransaction(transaction)),
  )
  notifyLocalDataChanged()
}

export async function removeLocalTransaction(transactionId: string): Promise<void> {
  await dawnlyDb.transactions.delete(transactionId)
  notifyLocalDataChanged()
}
