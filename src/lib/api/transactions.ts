import {
  toClientTransaction,
  type TransactionCreateInput,
  type TransactionListQuery,
  type TransactionListResponse,
  type TransactionMutationResponse,
  type TransactionUpdateInput,
} from '../../types/api'
import type { Transaction } from '../../types/transaction'
import { apiFetch } from './client'

function toQueryString(filters: TransactionListQuery): string {
  const params = new URLSearchParams()
  if (filters.name) {
    params.set('name', filters.name)
  }
  if (filters.direction) {
    params.set('direction', filters.direction)
  }
  if (filters.amount !== undefined) {
    params.set('amount', String(filters.amount))
  }
  if (filters.date_from) {
    params.set('date_from', filters.date_from)
  }
  if (filters.date_to) {
    params.set('date_to', filters.date_to)
  }
  if (filters.currency) {
    params.set('currency', filters.currency)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function fetchTransactions(
  token: string,
  filters: TransactionListQuery = {},
): Promise<Transaction[]> {
  const response = await apiFetch<TransactionListResponse>(
    `/api/transactions${toQueryString(filters)}`,
    { token },
  )
  return response.transactions.map(toClientTransaction)
}

export async function createTransactionRequest(
  token: string,
  input: TransactionCreateInput,
): Promise<Transaction> {
  const response = await apiFetch<TransactionMutationResponse>(
    '/api/transactions',
    { method: 'POST', token, body: input },
  )
  return toClientTransaction(response.transaction)
}

export async function updateTransactionRequest(
  token: string,
  id: string,
  input: TransactionUpdateInput,
): Promise<Transaction> {
  const response = await apiFetch<TransactionMutationResponse>(
    `/api/transactions/${id}`,
    { method: 'PATCH', token, body: input },
  )
  return toClientTransaction(response.transaction)
}

export async function deleteTransactionRequest(
  token: string,
  id: string,
  clientMutationId: string,
): Promise<void> {
  await apiFetch<null>(`/api/transactions/${id}`, {
    method: 'DELETE',
    token,
    body: { client_mutation_id: clientMutationId },
  })
}
