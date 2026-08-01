import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalDatabase, dawnlyDb, DawnlyDatabase } from './database'
import {
  queueCreateTransaction,
  queueDeleteTransaction,
  queueUpdateTransaction,
  markLocalTransactionSynced,
  readCachedTransactions,
} from './transactions'
import { requestSync } from '../sync/syncWorker'
import { sampleTransactions } from '../../test/fixtures/transactions'
import type { ApiTransaction } from '../../types/api'

const localCreateInput = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'منى',
  direction: 'receivable' as const,
  amount: 75,
  transaction_date: '2026-08-01',
  currency: 'EGP' as const,
}

function toApiTransaction(transaction: {
  id: string
  name: string
  direction: 'receivable' | 'payable'
  amount: number
  notes?: string | null
  transactionDate: string
  currency: 'EGP'
  createdAt: string
  updatedAt: string
}): ApiTransaction {
  return {
    id: transaction.id,
    name: transaction.name,
    direction: transaction.direction,
    amount: transaction.amount,
    notes: transaction.notes ?? null,
    transaction_date: transaction.transactionDate,
    currency: transaction.currency,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
  }
}

beforeEach(async () => {
  await clearLocalDatabase()
})

afterEach(async () => {
  await clearLocalDatabase()
  vi.unstubAllGlobals()
})

describe('Phase 4 local-first persistence', () => {
  it('stores an optimistic transaction and its mutation as one local change', async () => {
    const queued = await queueCreateTransaction(localCreateInput)

    expect(await readCachedTransactions()).toEqual([queued.transaction])
    expect(await dawnlyDb.pendingMutations.toArray()).toMatchObject([
      {
        operation: 'create',
        transactionId: localCreateInput.id,
        clientMutationId: queued.mutation.clientMutationId,
        attemptCount: 0,
        lastError: null,
      },
    ])
    const storedTransaction = await dawnlyDb.transactions.get(localCreateInput.id)
    const storedMutation = await dawnlyDb.pendingMutations.get(
      queued.mutation.clientMutationId,
    )
    expect(storedTransaction).not.toHaveProperty('name')
    expect(storedTransaction).not.toHaveProperty('amount')
    expect(storedTransaction?.encryptedPayload).toMatch(/^v1\./)
    expect(storedMutation).not.toHaveProperty('payload')
    expect(storedMutation?.encryptedPayload).toMatch(/^v1\./)
  })

  it('keeps the optimistic change queued when the network is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const queued = await queueCreateTransaction(localCreateInput)

    const summary = await requestSync('test-session', queued.mutation.clientMutationId)

    expect(summary.processed).toBe(0)
    expect(await dawnlyDb.pendingMutations.get(queued.mutation.clientMutationId)).toMatchObject({
      attemptCount: 1,
      lastError: 'تعذرت المزامنة الآن. ستتم المحاولة تلقائيًا عند عودة الاتصال.',
    })
    expect(await readCachedTransactions()).toEqual([queued.transaction])
  })

  it('keeps an optimistic edit queued when the network is unavailable', async () => {
    const existing = sampleTransactions[0]!
    await markLocalTransactionSynced(existing)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    const queued = await queueUpdateTransaction(existing.id, { amount: 999 })
    const summary = await requestSync('test-session', queued.mutation.clientMutationId)

    expect(summary.processed).toBe(0)
    expect(await readCachedTransactions()).toEqual([
      expect.objectContaining({
        id: existing.id,
        amount: 999,
      }),
    ])
    expect(await dawnlyDb.pendingMutations.get(queued.mutation.clientMutationId)).toMatchObject({
      operation: 'update',
      attemptCount: 1,
      lastError: expect.any(String),
    })
  })

  it('replays queued mutations in order and does not replay a completed queue', async () => {
    const secondInput = {
      ...localCreateInput,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'سارة',
    }
    const firstQueued = await queueCreateTransaction(localCreateInput)
    const secondQueued = await queueCreateTransaction(secondInput)
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain('/api/transactions')
      const body = JSON.parse(String(init?.body)) as {
        id: string
        client_mutation_id: string
      }
      const source = body.id === localCreateInput.id ? localCreateInput : secondInput
      const timestamp = new Date().toISOString()
      return Response.json(
        {
          transaction: {
            ...source,
            created_at: timestamp,
            updated_at: timestamp,
          },
        },
        { status: 201 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const summary = await requestSync('test-session')
    await requestSync('test-session')

    expect(summary.processed).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).client_mutation_id)).toEqual([
      firstQueued.mutation.clientMutationId,
      secondQueued.mutation.clientMutationId,
    ])
    expect(await dawnlyDb.pendingMutations.count()).toBe(0)
  })

  it('replaces a conflicted optimistic update with the server version', async () => {
    const existing = sampleTransactions[0]!
    await markLocalTransactionSynced(existing)
    const queued = await queueUpdateTransaction(existing.id, { amount: 999 })
    const serverVersion = { ...existing, amount: 300, updatedAt: '2026-08-01T12:00:00.000Z' }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes(`/api/transactions/${existing.id}`)) {
        return Response.json(
          { error: { code: 'conflict', message: 'conflict' } },
          { status: 409 },
        )
      }
      return Response.json({ transactions: [toApiTransaction(serverVersion)] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const summary = await requestSync('test-session', queued.mutation.clientMutationId)

    expect(summary.conflictMutationId).toBe(queued.mutation.clientMutationId)
    expect(await dawnlyDb.pendingMutations.count()).toBe(0)
    expect(await readCachedTransactions()).toEqual([serverVersion])
  })

  it('keeps an offline delete through a database reopen and replays it once', async () => {
    const existing = sampleTransactions[1]!
    await markLocalTransactionSynced(existing)
    const mutation = await queueDeleteTransaction(existing.id)
    let networkAvailable = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(`/api/transactions/${existing.id}`)
      if (!networkAvailable) {
        throw new TypeError('offline')
      }
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await requestSync('test-session', mutation.clientMutationId)

    const reopenedDatabase = new DawnlyDatabase()

    expect(await reopenedDatabase.pendingMutations.get(mutation.clientMutationId)).toBeTruthy()
    expect(await readCachedTransactions()).toEqual([])
    await reopenedDatabase.close()

    networkAvailable = true

    await requestSync('test-session', mutation.clientMutationId)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await dawnlyDb.pendingMutations.count()).toBe(0)
    expect(await readCachedTransactions()).toEqual([])
  })
})
