import { ApiClientError } from '../api/client'
import {
  createTransactionRequest,
  deleteTransactionRequest,
  fetchTransactions,
  updateTransactionRequest,
} from '../api/transactions'
import {
  cacheServerTransactions,
  markLocalTransactionSynced,
  markMutationAttempt,
  markMutationError,
  readNextPendingMutation,
  removeLocalTransaction,
  removeMutationsForTransaction,
  removePendingMutation,
} from '../local/transactions'
import { setSyncNotice } from '../local/status'
import { errorType, logClientFailure } from '../observability'
import type { PendingMutation } from '../../types/local'
import type { Transaction } from '../../types/transaction'

export type SyncSummary = {
  processed: number
  conflictMutationId: string | null
  conflictMessage: string | null
}

type ReplayOutcome =
  | { kind: 'success' }
  | { kind: 'retry'; message: string }
  | { kind: 'conflict'; message: string }

let activeSync: Promise<SyncSummary> | null = null

function createEmptySummary(): SyncSummary {
  return {
    processed: 0,
    conflictMutationId: null,
    conflictMessage: null,
  }
}

function isServerConflict(error: ApiClientError): boolean {
  return ['duplicate', 'not_found', 'validation_error', 'conflict'].includes(
    error.code,
  )
}

function conflictMessage(error: ApiClientError): string {
  if (error.code === 'duplicate') {
    return error.message
  }
  return 'تم تحديث السجل من الخادم، وتم اعتماد أحدث نسخة.'
}

function retryMessage(error: ApiClientError): string {
  if (error.code === 'unauthorized') {
    return 'يلزم إدخال الرقم السري لمتابعة المزامنة.'
  }
  return 'تعذرت المزامنة الآن. ستتم المحاولة تلقائيًا عند عودة الاتصال.'
}

function isNetworkError(error: unknown): error is TypeError {
  return error instanceof TypeError
}

async function replayCreate(
  token: string,
  mutation: Extract<PendingMutation, { operation: 'create' }>,
): Promise<void> {
  const transaction = await createTransactionRequest(token, {
    ...mutation.payload,
    id: mutation.transactionId,
    client_mutation_id: mutation.clientMutationId,
  })
  await reconcileServerTransaction(mutation.transactionId, transaction)
}

async function replayUpdate(
  token: string,
  mutation: Extract<PendingMutation, { operation: 'update' }>,
): Promise<void> {
  const transaction = await updateTransactionRequest(token, mutation.transactionId, {
    ...mutation.payload,
    client_mutation_id: mutation.clientMutationId,
  })
  await markLocalTransactionSynced(transaction)
}

async function replayDelete(
  token: string,
  mutation: Extract<PendingMutation, { operation: 'delete' }>,
): Promise<void> {
  await deleteTransactionRequest(
    token,
    mutation.transactionId,
    mutation.clientMutationId,
  )
  await removeLocalTransaction(mutation.transactionId)
}

async function reconcileServerTransaction(
  localTransactionId: string,
  serverTransaction: Transaction,
): Promise<void> {
  if (localTransactionId !== serverTransaction.id) {
    await removeLocalTransaction(localTransactionId)
  }
  await markLocalTransactionSynced(serverTransaction)
}

async function replayMutation(
  token: string,
  mutation: PendingMutation,
): Promise<ReplayOutcome> {
  try {
    if (mutation.operation === 'create') {
      await replayCreate(token, mutation)
    } else if (mutation.operation === 'update') {
      await replayUpdate(token, mutation)
    } else {
      await replayDelete(token, mutation)
    }
    return { kind: 'success' }
  } catch (error) {
    if (error instanceof ApiClientError) {
      logClientFailure('sync_mutation_failed', {
        route: '/api/transactions',
        operation: mutation.operation,
        status: error.status,
        code: error.code,
      })
      return isServerConflict(error)
        ? { kind: 'conflict', message: conflictMessage(error) }
        : { kind: 'retry', message: retryMessage(error) }
    }
    if (isNetworkError(error)) {
      logClientFailure('sync_network_failed', {
        route: '/api/transactions',
        operation: mutation.operation,
        errorType: errorType(error),
      })
      return {
        kind: 'retry',
        message: 'تعذرت المزامنة الآن. ستتم المحاولة تلقائيًا عند عودة الاتصال.',
      }
    }
    throw error
  }
}

async function resolveServerConflict(
  token: string,
  mutation: PendingMutation,
  message: string,
): Promise<void> {
  const serverTransactions = await fetchTransactions(token)
  await removeMutationsForTransaction(mutation.transactionId)
  await removeLocalTransaction(mutation.transactionId)
  await cacheServerTransactions(serverTransactions, {})
  await setSyncNotice(message)
}

async function runSync(
  token: string,
  focusMutationId: string | null,
): Promise<SyncSummary> {
  const summary = createEmptySummary()

  while (true) {
    const nextMutation = await readNextPendingMutation()
    if (!nextMutation) {
      if (!summary.conflictMessage) {
        await setSyncNotice(null)
      }
      return summary
    }

    const attemptedMutation = await markMutationAttempt(nextMutation)
    const outcome = await replayMutation(token, attemptedMutation)

    if (outcome.kind === 'retry') {
      await markMutationError(attemptedMutation.clientMutationId, outcome.message)
      return summary
    }

    if (outcome.kind === 'conflict') {
      try {
        await resolveServerConflict(token, attemptedMutation, outcome.message)
      } catch (error) {
        if (!isNetworkError(error)) {
          throw error
        }
        logClientFailure('sync_conflict_refresh_failed', {
          route: '/api/transactions',
          operation: attemptedMutation.operation,
          errorType: errorType(error),
        })
        await markMutationError(
          attemptedMutation.clientMutationId,
          'تعذرت قراءة النسخة المحفوظة في الخادم. ستتم المحاولة تلقائيًا.',
        )
        return summary
      }
      summary.conflictMutationId = attemptedMutation.clientMutationId
      summary.conflictMessage = outcome.message
    } else {
      await removePendingMutation(attemptedMutation.clientMutationId)
    }

    summary.processed += 1
    if (focusMutationId === attemptedMutation.clientMutationId) {
      return summary
    }
  }
}

export function requestSync(
  token: string,
  focusMutationId: string | null = null,
): Promise<SyncSummary> {
  const previousSync = activeSync ?? Promise.resolve(createEmptySummary())
  const nextSync = previousSync
    .then(() => runSync(token, focusMutationId))
    .catch((cause) => {
      logClientFailure('sync_failed', {
        route: '/api/transactions',
        errorType: errorType(cause),
      })
      throw cause
    })
  const trackedSync = nextSync.finally(() => {
    if (activeSync === trackedSync) {
      activeSync = null
    }
  })
  activeSync = trackedSync
  return trackedSync
}
