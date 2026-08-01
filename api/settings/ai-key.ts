import type { VercelRequest, VercelResponse } from '@vercel/node'
import { aiKeyUpdateRequestSchema } from '../../src/types/api.ts'
import { readServerEnv } from '../_lib/env.ts'
import { apiError } from '../_lib/http.ts'
import { errorType, logServerFailure } from '../_lib/observability.ts'
import {
  readAiKeyStatus,
  setAiProvider,
  upsertAiKeyInVault,
} from '../_lib/openRouterSecret.ts'
import { requireDawnlySession } from '../_lib/requireSession.ts'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    response.setHeader('Allow', 'GET, PUT')
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
      const status = await readAiKeyStatus(auth.value.supabase)
      return response.status(200).json(status)
    }

    const parsed = aiKeyUpdateRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      const failure = apiError(
        400,
        'validation_error',
        'أدخل مزوداً صالحاً أو مفتاح API صالحاً',
      )
      return response.status(failure.status).json(failure.body)
    }

    const { provider, api_key: apiKey } = parsed.data
    const client = auth.value.supabase

    if (apiKey) {
      await upsertAiKeyInVault(client, provider, apiKey)
      const status = await setAiProvider(client, provider)
      return response.status(200).json(status)
    }

    const status = await setAiProvider(client, provider)
    return response.status(200).json(status)
  } catch (cause) {
    logServerFailure('ai_settings_failed', {
      route: '/api/settings/ai-key',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'تعذر حفظ إعدادات الذكاء الاصطناعي',
      },
    })
  }
}
