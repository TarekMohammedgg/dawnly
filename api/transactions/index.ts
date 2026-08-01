import type { DawnlyRequest, DawnlyResponse } from '../_lib/platformTypes.js'
import {
  transactionCreateSchema,
  transactionListQuerySchema,
} from '../../src/types/api.js'
import { readServerEnv } from '../_lib/env.js'
import { apiError, setNoStore } from '../_lib/http.js'
import { errorType, logServerFailure } from '../_lib/observability.js'
import { requireDawnlySession } from '../_lib/requireSession.js'
import { createTransaction, listTransactions } from '../_lib/transactions.js'

function readQueryParams(
  query: DawnlyRequest['query'],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      result[key] = value[0]
    }
  }
  return result
}

export default async function handler(
  request: DawnlyRequest,
  response: DawnlyResponse,
) {
  setNoStore(response)

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({
      error: {
        code: 'validation_error',
        message: 'Method not allowed',
      },
    })
  }

  try {
    const env = readServerEnv()
    const auth = requireDawnlySession(request.headers.authorization, env)
    if (auth.ok === false) {
      return response.status(auth.response.status).json(auth.response.body)
    }

    if (request.method === 'GET') {
      const parsed = transactionListQuerySchema.safeParse(
        readQueryParams(request.query),
      )
      if (!parsed.success) {
        const failure = apiError(
          400,
          'validation_error',
          'مرشحات البحث غير صالحة',
          parsed.error.flatten(),
        )
        return response.status(failure.status).json(failure.body)
      }

      const { data, error } = await listTransactions(
        auth.value.supabase,
        parsed.data,
      )
      if (error) {
        logServerFailure('transactions_list_failed', {
          route: '/api/transactions',
          operation: 'list',
          status: 500,
          errorType: errorType(error),
        })
        const failure = apiError(500, 'internal_error', 'تعذر تحميل المعاملات')
        return response.status(failure.status).json(failure.body)
      }

      return response.status(200).json({ transactions: data })
    }

    const parsed = transactionCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      const failure = apiError(
        400,
        'validation_error',
        'بيانات المعاملة غير صالحة',
        parsed.error.flatten(),
      )
      return response.status(failure.status).json(failure.body)
    }

    const result = await createTransaction(auth.value.supabase, parsed.data)
    if (result.ok === false) {
      if (result.duplicate) {
        const failure = apiError(
          409,
          'duplicate',
          'هذه المعاملة موجودة بالفعل',
        )
        return response.status(failure.status).json(failure.body)
      }

      logServerFailure('transactions_create_failed', {
        route: '/api/transactions',
        operation: 'create',
        status: 500,
      })
      const failure = apiError(500, 'internal_error', 'تعذر حفظ المعاملة')
      return response.status(failure.status).json(failure.body)
    }

    return response
      .status(result.idempotent ? 200 : 201)
      .json({ transaction: result.transaction })
  } catch (cause) {
    logServerFailure('transactions_request_failed', {
      route: '/api/transactions',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'تعذر إكمال طلب المعاملات',
      },
    })
  }
}
