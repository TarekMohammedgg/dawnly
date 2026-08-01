import {
  evaluateLockout,
} from './pinLockout.js'
import { isSixDigitPin, verifyPinHash } from './pinHash.js'
import { createSessionToken } from './sessionToken.js'
import { verifyPinRequestSchema } from '../../src/types/api.js'
import type {
  PinAttemptDecision,
  PinAttemptStore,
} from './pinAttemptStore.js'
import { apiError, json } from './http.js'

export type VerifyPinDeps = {
  pinHash: string
  sessionSecret: string
  store: PinAttemptStore
  now?: Date
}

export async function handleVerifyPin(
  body: unknown,
  deps: VerifyPinDeps,
): Promise<{ status: number; body: unknown }> {
  const parsed = verifyPinRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'validation_error', 'يجب إدخال رقم سري مكون من ٦ أرقام')
  }

  const { pin } = parsed.data
  if (!isSixDigitPin(pin)) {
    return apiError(400, 'validation_error', 'يجب إدخال رقم سري مكون من ٦ أرقام')
  }

  const now = deps.now ?? new Date()
  const currentState = await deps.store.read()
  const lockout = evaluateLockout(currentState, now)

  if (lockout.status === 'locked') {
    return {
      status: 429,
      body: {
        error: {
          code: 'locked',
          message: 'تم إيقاف المحاولة لمدة دقيقة بعد ٥ محاولات خاطئة',
          details: {
            locked_until: lockout.lockedUntil,
            retry_after_seconds: lockout.retryAfterSeconds,
          },
        },
      },
    }
  }

  const accepted = verifyPinHash(pin, deps.pinHash)
  const decision = await deps.store.recordAttempt(accepted, now)
  if (decision.status === 'locked') {
    return lockedPinResponse(decision)
  }

  if (!accepted) {
    return apiError(401, 'invalid_pin', 'الرقم السري غير صحيح')
  }

  if (decision.status !== 'accepted') {
    throw new Error('PIN store returned an invalid accepted-attempt decision')
  }

  const { token, payload } = createSessionToken(deps.sessionSecret)
  return json(200, {
    token,
    expires_at: new Date(payload.exp * 1000).toISOString(),
  })
}

function lockedPinResponse(
  decision: Extract<PinAttemptDecision, { status: 'locked' }>,
): { status: number; body: unknown } {
  return apiError(
    429,
    'locked',
    'تم إيقاف المحاولة لمدة دقيقة بعد ٥ محاولات خاطئة',
    {
      locked_until: decision.locked_until,
      retry_after_seconds: decision.retry_after_seconds,
    },
  )
}
