import { useCallback, useEffect, useState } from 'react'
import { ApiClientError } from '../../lib/api/client'
import { fetchTransactions } from '../../lib/api/transactions'
import { useAuthSession } from '../../lib/auth/sessionContext'
import {
  cacheServerTransactions,
  queueCreateTransaction,
  queueDeleteTransaction,
  queueUpdateTransaction,
  readCachedTransactions,
} from '../../lib/local/transactions'
import {
  notifyLocalDataChanged,
  subscribeLocalDataChanged,
} from '../../lib/local/status'
import { requestSync } from '../../lib/sync/syncWorker'
import type {
  TransactionCreateInput,
  TransactionListQuery,
  TransactionUpdateInput,
} from '../../types/api'
import type { Transaction } from '../../types/transaction'

type UseTransactionsResult = {
  transactions: Transaction[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: TransactionCreateInput) => Promise<Transaction>
  update: (id: string, input: TransactionUpdateInput) => Promise<Transaction>
  remove: (id: string) => Promise<void>
}

function parseFilters(filterKey: string): TransactionListQuery {
  return JSON.parse(filterKey) as TransactionListQuery
}

function errorMessage(cause: unknown): string {
  return cause instanceof ApiClientError
    ? cause.message
    : 'تعذر تحميل المعاملات'
}

function createConflictError(message: string): ApiClientError {
  return new ApiClientError(
    409,
    { error: { code: 'conflict', message } },
    message,
  )
}

export function useTransactions(
  filters: TransactionListQuery = {},
): UseTransactionsResult {
  const { session } = useAuthSession()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const filterKey = JSON.stringify(filters)
  const token = session?.token ?? null

  useEffect(() => {
    let cancelled = false
    const parsedFilters = parseFilters(filterKey)

    async function loadTransactions() {
      if (!token) {
        setTransactions([])
        setLoading(false)
        setError(null)
        return
      }

      const cachedTransactions = await readCachedTransactions(parsedFilters)
      if (!cancelled) {
        setTransactions(cachedTransactions)
        setLoading(cachedTransactions.length === 0)
        setError(null)
      }

      void requestSync(token)
      try {
        const serverTransactions = await fetchTransactions(token, parsedFilters)
        await cacheServerTransactions(serverTransactions, parsedFilters)
        const refreshedTransactions = await readCachedTransactions(parsedFilters)
        if (!cancelled) {
          setTransactions(refreshedTransactions)
          setError(null)
        }
      } catch (cause) {
        if (!cancelled && cachedTransactions.length === 0) {
          setError(errorMessage(cause))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTransactions()
    return () => {
      cancelled = true
    }
  }, [filterKey, reloadToken, token])

  useEffect(() => {
    if (!token) {
      return
    }

    const parsedFilters = parseFilters(filterKey)
    let cancelled = false
    const refreshCachedTransactions = () => {
      void readCachedTransactions(parsedFilters).then((cachedTransactions) => {
        if (!cancelled) {
          setTransactions(cachedTransactions)
        }
      })
    }
    const unsubscribe = subscribeLocalDataChanged(refreshCachedTransactions)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [filterKey, token])

  useEffect(() => {
    if (!token) {
      return
    }

    const synchronizeWhenOnline = () => {
      void requestSync(token).then(() => {
        notifyLocalDataChanged()
      })
    }
    window.addEventListener('online', synchronizeWhenOnline)
    return () => window.removeEventListener('online', synchronizeWhenOnline)
  }, [token])

  const reload = useCallback(async () => {
    setReloadToken((current) => current + 1)
  }, [])

  const create = useCallback(
    async (input: TransactionCreateInput) => {
      if (!token) {
        throw new Error('يلزم تسجيل الدخول بالرقم السري')
      }
      const queued = await queueCreateTransaction(input)
      const syncSummary = await requestSync(
        token,
        queued.mutation.clientMutationId,
      )
      if (syncSummary.conflictMutationId === queued.mutation.clientMutationId) {
        throw createConflictError(
          syncSummary.conflictMessage ?? 'تعذر اعتماد المعاملة المحفوظة',
        )
      }
      return queued.transaction
    },
    [token],
  )

  const update = useCallback(
    async (id: string, input: TransactionUpdateInput) => {
      if (!token) {
        throw new Error('يلزم تسجيل الدخول بالرقم السري')
      }
      const queued = await queueUpdateTransaction(id, input)
      const syncSummary = await requestSync(
        token,
        queued.mutation.clientMutationId,
      )
      if (syncSummary.conflictMutationId === queued.mutation.clientMutationId) {
        throw createConflictError(
          syncSummary.conflictMessage ?? 'تم اعتماد أحدث نسخة من الخادم',
        )
      }
      return queued.transaction
    },
    [token],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!token) {
        throw new Error('يلزم تسجيل الدخول بالرقم السري')
      }
      const mutation = await queueDeleteTransaction(id)
      await requestSync(token, mutation.clientMutationId)
    },
    [token],
  )

  return {
    transactions,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  }
}
