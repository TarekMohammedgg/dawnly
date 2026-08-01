import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  extractTransactionRequestSchema,
  type ExtractTransactionResponse,
} from '../../src/types/api.js'
import { extractTransactionDraft } from '../_lib/ai/extractTransaction.js'
import { allowAiExtractRequest } from '../_lib/ai/rateLimit.js'
import { readServerEnv } from '../_lib/env.js'
import { apiError, readBearerToken } from '../_lib/http.js'
import { errorType, logServerFailure } from '../_lib/observability.js'
import { resolveAiApiKey } from '../_lib/openRouterSecret.js'
import { requireDawnlySession } from '../_lib/requireSession.js'

function isAbortError(cause: unknown): boolean {
  return (
    cause instanceof Error &&
    (cause.name === 'AbortError' || cause.message.includes('abort'))
  )
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
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

    const rateKey = readBearerToken(request.headers.authorization) ?? 'anonymous'
    if (!allowAiExtractRequest(rateKey)) {
      const failure = apiError(
        429,
        'rate_limited',
        'تم تجاوز حد طلبات التحليل. حاول بعد دقيقة',
      )
      return response.status(failure.status).json(failure.body)
    }

    const parsed = extractTransactionRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      const failure = apiError(
        400,
        'validation_error',
        'نص التسجيل غير صالح أو طويل جداً',
      )
      return response.status(failure.status).json(failure.body)
    }

    const resolved = await resolveAiApiKey(auth.value.supabase)
    if (!resolved) {
      const failure = apiError(
        400,
        'validation_error',
        'اضبط مفتاح مزود الذكاء الاصطناعي من الإعدادات أولاً',
      )
      return response.status(failure.status).json(failure.body)
    }

    const { transcript } = parsed.data

    try {
      const draft = await extractTransactionDraft(
        resolved.provider,
        resolved.key,
        transcript,
      )

      const body: ExtractTransactionResponse = {
        transcript,
        draft,
        confidence: null,
      }
      return response.status(200).json(body)
    } catch (cause) {
      if (isAbortError(cause)) {
        logServerFailure('ai_provider_timeout', {
          route: '/api/ai/extract-transaction',
          provider: resolved.provider,
          status: 504,
          errorType: errorType(cause),
        })
        const failure = apiError(
          504,
          'internal_error',
          'انتهت مهلة تحليل التسجيل. حاول مرة أخرى',
        )
        return response.status(failure.status).json(failure.body)
      }

      logServerFailure('ai_provider_failed', {
        route: '/api/ai/extract-transaction',
        provider: resolved.provider,
        status: 502,
        errorType: errorType(cause),
      })

      const failure = apiError(
        502,
        'internal_error',
        'تعذر تحليل التسجيل. حاول مرة أخرى لاحقاً',
      )
      return response.status(failure.status).json(failure.body)
    }
  } catch (cause) {
    logServerFailure('ai_request_failed', {
      route: '/api/ai/extract-transaction',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'تعذر إكمال طلب التحليل',
      },
    })
  }
}
