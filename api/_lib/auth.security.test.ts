/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { hashPin, isSixDigitPin, verifyPinHash } from './pinHash'
import {
  evaluateLockout,
  MAX_PIN_FAILURES,
  nextStateAfterFailure,
  resetPinAttemptState,
} from './pinLockout'
import { createSessionToken, verifySessionToken } from './sessionToken'

describe('pinHash', () => {
  it('accepts only exact six ASCII digits', () => {
    expect(isSixDigitPin('123456')).toBe(true)
    expect(isSixDigitPin('12345')).toBe(false)
    expect(isSixDigitPin('1234567')).toBe(false)
    expect(isSixDigitPin('12a456')).toBe(false)
  })

  it('verifies a scrypt PIN hash without storing the plain PIN', () => {
    const hash = hashPin('246810')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPinHash('246810', hash)).toBe(true)
    expect(verifyPinHash('000000', hash)).toBe(false)
  })
})

describe('sessionToken', () => {
  const secret = 'test-session-secret-value'

  it('creates a verifiable short-lived token', () => {
    const now = 1_700_000_000
    const { token, payload } = createSessionToken(secret, now, 60)
    expect(verifySessionToken(token, secret, now + 30)).toEqual(payload)
  })

  it('rejects expired, malformed, and forged tokens', () => {
    const now = 1_700_000_000
    const { token } = createSessionToken(secret, now, 10)

    expect(verifySessionToken(token, secret, now + 11)).toBeNull()
    expect(verifySessionToken('not-a-token', secret, now)).toBeNull()
    expect(verifySessionToken(`${token}x`, secret, now)).toBeNull()
    expect(verifySessionToken(token, 'other-secret', now)).toBeNull()
  })
})

describe('pinLockout', () => {
  it('locks after five failures for sixty seconds', () => {
    const now = new Date('2026-08-01T00:00:00.000Z')
    let state = resetPinAttemptState()

    for (let attempt = 1; attempt < MAX_PIN_FAILURES; attempt += 1) {
      state = nextStateAfterFailure(state, now)
      expect(evaluateLockout(state, now).status).toBe('ok')
    }

    state = nextStateAfterFailure(state, now)
    const locked = evaluateLockout(state, now)
    expect(locked.status).toBe('locked')
    if (locked.status === 'locked') {
      expect(locked.retryAfterSeconds).toBe(60)
    }

    const afterLockout = evaluateLockout(
      state,
      new Date(now.getTime() + 60_000),
    )
    expect(afterLockout.status).toBe('ok')
  })
})
