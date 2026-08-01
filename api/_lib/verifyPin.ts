import {
  evaluateLockout,
  nextStateAfterFailure,
  resetPinAttemptState,
} from './pinLockout.ts'
import { isSixDigitPin, verifyPinHash } from './pinHash.ts'
import { createSessionToken } from './sessionToken.ts'
import { verifyPinRequestSchema } from '../../src/types/api.ts'
import type { PinAttemptStore } from './pinAttemptStore.ts'
import { apiError, json } from './http.ts'

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
  const current = await deps.store.read()
  const lockout = evaluateLockout(current, now)

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
  if (!accepted) {
    const next = nextStateAfterFailure(current, now)
    await deps.store.write(next)

    if (next.lockedUntil) {
      const locked = evaluateLockout(next, now)
      if (locked.status === 'locked') {
        return {
          status: 429,
          body: {
            error: {
              code: 'locked',
              message: 'تم إيقاف المحاولة لمدة دقيقة بعد ٥ محاولات خاطئة',
              details: {
                locked_until: locked.lockedUntil,
                retry_after_seconds: locked.retryAfterSeconds,
              },
            },
          },
        }
      }
    }

    return apiError(401, 'invalid_pin', 'الرقم السري غير صحيح')
  }

  await deps.store.write(resetPinAttemptState())
  const { token, payload } = createSessionToken(deps.sessionSecret)
  return json(200, {
    token,
    expires_at: new Date(payload.exp * 1000).toISOString(),
  })
}
