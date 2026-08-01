export const MAX_PIN_FAILURES = 5
export const LOCKOUT_DURATION_MS = 60_000

export type PinAttemptState = {
  failedAttempts: number
  lockedUntil: string | null
}

export type LockoutDecision =
  | { status: 'ok' }
  | { status: 'locked'; lockedUntil: string; retryAfterSeconds: number }

export function evaluateLockout(
  state: PinAttemptState,
  now = new Date(),
): LockoutDecision {
  if (!state.lockedUntil) {
    return { status: 'ok' }
  }

  const lockedUntilMs = Date.parse(state.lockedUntil)
  if (Number.isNaN(lockedUntilMs) || lockedUntilMs <= now.getTime()) {
    return { status: 'ok' }
  }

  return {
    status: 'locked',
    lockedUntil: new Date(lockedUntilMs).toISOString(),
    retryAfterSeconds: Math.ceil((lockedUntilMs - now.getTime()) / 1000),
  }
}

export function nextStateAfterFailure(
  state: PinAttemptState,
  now = new Date(),
): PinAttemptState {
  const activeLock = evaluateLockout(state, now)
  const baseAttempts =
    activeLock.status === 'ok' && state.lockedUntil ? 0 : state.failedAttempts
  const failedAttempts = baseAttempts + 1

  if (failedAttempts >= MAX_PIN_FAILURES) {
    return {
      failedAttempts,
      lockedUntil: new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString(),
    }
  }

  return {
    failedAttempts,
    lockedUntil: null,
  }
}

export function resetPinAttemptState(): PinAttemptState {
  return {
    failedAttempts: 0,
    lockedUntil: null,
  }
}
