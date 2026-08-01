import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSecretClient, readServerEnv } from '../_lib/env.js'
import {
  CRON_SECRET_HEADER,
  hasValidCronSecret,
  readCronSecret,
} from '../_lib/cronAuth.js'
import { errorType, logServerFailure } from '../_lib/observability.js'

function readHeader(
  request: VercelRequest,
  name: string,
): string | undefined {
  const headerValue = request.headers[name]
  return Array.isArray(headerValue) ? headerValue[0] : headerValue
}

async function readSupabaseHealth(): Promise<void> {
  const env = readServerEnv()
  const { error } = await createSecretClient(env)
    .from('transactions')
    .select('id', { head: true })
    .limit(1)

  if (error) {
    throw error
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({
      error: {
        code: 'validation_error',
        message: 'Method not allowed',
      },
    })
  }

  let expectedSecret: string
  try {
    expectedSecret = readCronSecret()
  } catch (cause) {
    logServerFailure('health_cron_configuration_failed', {
      route: '/api/health/supabase',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'إعداد فحص الخدمة غير مكتمل',
      },
    })
  }

  const presentedSecret = readHeader(request, CRON_SECRET_HEADER)
  if (!hasValidCronSecret(presentedSecret, expectedSecret)) {
    logServerFailure('health_cron_unauthorized', {
      route: '/api/health/supabase',
      status: 401,
    })
    return response.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'هذا الطلب غير مصرح به',
      },
    })
  }

  try {
    await readSupabaseHealth()
    return response.status(200).json({ healthy: true })
  } catch (cause) {
    logServerFailure('health_supabase_failed', {
      route: '/api/health/supabase',
      status: 503,
      errorType: errorType(cause),
    })
    return response.status(503).json({
      error: {
        code: 'health_check_failed',
        message: 'تعذر الوصول إلى قاعدة البيانات حالياً',
      },
    })
  }
}
