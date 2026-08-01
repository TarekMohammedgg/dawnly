import type { DawnlyRequest, DawnlyResponse } from '../_lib/platformTypes.js'
import { z } from 'zod'
import {
  transactionDeleteSchema,
  transactionUpdateSchema,
} from '../../src/types/api.js'
import { readServerEnv } from '../_lib/env.js'
import { apiError, setNoStore } from '../_lib/http.js'
import { errorType, logServerFailure } from '../_lib/observability.js'
import { requireDawnlySession } from '../_lib/requireSession.js'
import {
  deleteTransaction,
  updateTransaction,
} from '../_lib/transactions.js'

const idSchema = z.string().uuid()

function readTransactionId(query: DawnlyRequest['query']): string | null {
  const raw = query.id
  if (typeof raw === 'string') {
    return raw
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    return raw[0]
  }
  return null
}

export default async function handler(
  request: DawnlyRequest,
  response: DawnlyResponse,
) {
  setNoStore(response)

  if (request.method !== 'PATCH' && request.method !== 'DELETE') {
    response.setHeader('Allow', 'PATCH, DELETE')
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

    const idParsed = idSchema.safeParse(readTransactionId(request.query))
    if (!idParsed.success) {
      const failure = apiError(400, 'validation_error', 'معرّف المعاملة غير صالح')
      return response.status(failure.status).json(failure.body)
    }

    const id = idParsed.data

    if (request.method === 'DELETE') {
      const parsed = transactionDeleteSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        const failure = apiError(
          400,
          'validation_error',
          'بيانات حذف المعاملة غير صالحة',
          parsed.error.flatten(),
        )
        return response.status(failure.status).json(failure.body)
      }

      const result = await deleteTransaction(
        auth.value.supabase,
        id,
        parsed.data.client_mutation_id,
      )
      if (result.ok === false) {
        if ('notFound' in result && result.notFound) {
          const failure = apiError(404, 'not_found', 'المعاملة غير موجودة')
          return response.status(failure.status).json(failure.body)
        }
        logServerFailure('transaction_delete_failed', {
          route: '/api/transactions/:id',
          operation: 'delete',
          status: 500,
        })
        const failure = apiError(500, 'internal_error', 'تعذر حذف المعاملة')
        return response.status(failure.status).json(failure.body)
      }

      return response.status(204).end()
    }

    const parsed = transactionUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      const failure = apiError(
        400,
        'validation_error',
        'بيانات المعاملة غير صالحة',
        parsed.error.flatten(),
      )
      return response.status(failure.status).json(failure.body)
    }

    const result = await updateTransaction(
      auth.value.supabase,
      id,
      parsed.data,
    )
    if (result.ok === false) {
      if ('notFound' in result && result.notFound) {
        const failure = apiError(404, 'not_found', 'المعاملة غير موجودة')
        return response.status(failure.status).json(failure.body)
      }
      if ('duplicate' in result && result.duplicate) {
        const failure = apiError(
          409,
          'duplicate',
          'هذه المعاملة موجودة بالفعل',
          result.transaction ? { transaction: result.transaction } : undefined,
        )
        return response.status(failure.status).json(failure.body)
      }
      logServerFailure('transaction_update_failed', {
        route: '/api/transactions/:id',
        operation: 'update',
        status: 500,
      })
      const failure = apiError(500, 'internal_error', 'تعذر تحديث المعاملة')
      return response.status(failure.status).json(failure.body)
    }

    return response.status(200).json({ transaction: result.transaction })
  } catch (cause) {
    logServerFailure('transaction_request_failed', {
      route: '/api/transactions/:id',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'تعذر إكمال طلب المعاملة',
      },
    })
  }
}
