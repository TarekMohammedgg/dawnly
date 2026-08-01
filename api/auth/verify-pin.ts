import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSecretClient, readServerEnv } from '../_lib/env.js'
import { createSupabasePinAttemptStore } from '../_lib/pinAttemptStore.js'
import { errorType, logServerFailure } from '../_lib/observability.js'
import { handleVerifyPin } from '../_lib/verifyPin.js'

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
    // Lockout reads/writes use the secret client (RLS denies publishable access).
    const store = createSupabasePinAttemptStore(createSecretClient(env))
    const result = await handleVerifyPin(request.body, {
      pinHash: env.pinHash,
      sessionSecret: env.sessionSecret,
      store,
    })
    return response.status(result.status).json(result.body)
  } catch (cause) {
    logServerFailure('pin_verification_failed', {
      route: '/api/auth/verify-pin',
      status: 500,
      errorType: errorType(cause),
    })
    return response.status(500).json({
      error: {
        code: 'internal_error',
        message: 'تعذر التحقق من الرقم السري حالياً',
      },
    })
  }
}
