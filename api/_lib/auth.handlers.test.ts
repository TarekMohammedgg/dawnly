/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { createMemoryPinAttemptStore } from './pinAttemptStore'
import { requireDawnlySession } from './requireSession'
import { handleVerifyPin } from './verifyPin'
import { hashPin } from './pinHash'
import { createSessionToken } from './sessionToken'
import type { ServerEnv } from './env'

const TEST_PIN = '135790'
const pinHash = hashPin(TEST_PIN)
const sessionSecret = 'phase2-test-session-secret'

function testEnv(): ServerEnv {
  return {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test',
    supabaseSecretKey: 'sb_secret_test',
    pinHash,
    sessionSecret,
  }
}

describe('verify-pin handler', () => {
  it('returns a session token for a valid PIN', async () => {
    const store = createMemoryPinAttemptStore()
    const result = await handleVerifyPin(
      { pin: TEST_PIN },
      { pinHash, sessionSecret, store },
    )

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      token: expect.any(String),
      expires_at: expect.any(String),
    })
  })

  it('rejects an invalid PIN and locks after the fifth failure', async () => {
    const store = createMemoryPinAttemptStore()
    const now = new Date('2026-08-01T12:00:00.000Z')

    for (let i = 0; i < 4; i += 1) {
      const result = await handleVerifyPin(
        { pin: '000000' },
        { pinHash, sessionSecret, store, now },
      )
      expect(result.status).toBe(401)
    }

    const locked = await handleVerifyPin(
      { pin: '000000' },
      { pinHash, sessionSecret, store, now },
    )
    expect(locked.status).toBe(429)
    expect(locked.body).toMatchObject({
      error: { code: 'locked' },
    })

    const stillLocked = await handleVerifyPin(
      { pin: TEST_PIN },
      { pinHash, sessionSecret, store, now },
    )
    expect(stillLocked.status).toBe(429)
  })

  it('rejects non-six-digit PIN bodies', async () => {
    const store = createMemoryPinAttemptStore()
    const result = await handleVerifyPin(
      { pin: '12345' },
      { pinHash, sessionSecret, store },
    )
    expect(result.status).toBe(400)
  })
})

describe('requireDawnlySession', () => {
  it('rejects missing, expired, and forged tokens', () => {
    const env = testEnv()

    const missing = requireDawnlySession(undefined, env)
    expect(missing.ok).toBe(false)

    const expiredToken = createSessionToken(
      sessionSecret,
      Math.floor(Date.now() / 1000) - 120,
      30,
    ).token
    const expired = requireDawnlySession(`Bearer ${expiredToken}`, env)
    expect(expired.ok).toBe(false)

    const { token } = createSessionToken(sessionSecret)
    const forged = requireDawnlySession(`Bearer ${token}tampered`, env)
    expect(forged.ok).toBe(false)
  })

  it('accepts a valid bearer token', () => {
    const env = testEnv()
    const { token } = createSessionToken(sessionSecret)
    const result = requireDawnlySession(`Bearer ${token}`, env)
    expect(result.ok).toBe(true)
  })
})
