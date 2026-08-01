/** @vitest-environment node */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './supabase.js'

const ENVIRONMENT_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DAWNLY_PIN_HASH',
  'DAWNLY_SESSION_SECRET',
  'DAWNLY_CRON_SECRET',
]
const originalEnvironment = new Map(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
)

function setHealthEnvironment(): void {
  process.env.SUPABASE_URL = 'https://health-test.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test'
  process.env.DAWNLY_PIN_HASH = 'test-pin-hash'
  process.env.DAWNLY_SESSION_SECRET = 'test-session-secret'
  process.env.DAWNLY_CRON_SECRET = 'cron-secret'
}

function createResponseRecorder(): {
  response: VercelResponse
  read: () => { status: number; body: unknown }
} {
  let status = 200
  let body: unknown
  const response = {
    setHeader: vi.fn(),
    status(nextStatus: number) {
      status = nextStatus
      return response
    },
    json(nextBody: unknown) {
      body = nextBody
      return response
    },
  } as unknown as VercelResponse

  return {
    response,
    read: () => ({ status, body }),
  }
}

function createRequest(secret?: string): VercelRequest {
  return {
    method: 'GET',
    headers: secret ? { 'x-dawnly-cron-secret': secret } : {},
  } as unknown as VercelRequest
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const [key, originalValue] of originalEnvironment) {
    if (originalValue === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
})

describe('Supabase health endpoint', () => {
  it('rejects requests without the configured Cron secret before reading Supabase', async () => {
    setHealthEnvironment()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const recorder = createResponseRecorder()

    await handler(createRequest(), recorder.response)

    expect(recorder.read()).toEqual({
      status: 401,
      body: {
        error: {
          code: 'unauthorized',
          message: 'هذا الطلب غير مصرح به',
        },
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('performs a server-only head read and returns health without transaction data', async () => {
    setHealthEnvironment()
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const recorder = createResponseRecorder()

    await handler(createRequest('cron-secret'), recorder.response)

    expect(recorder.read()).toEqual({ status: 200, body: { healthy: true } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toContain('/rest/v1/transactions')
    expect(init.method).toBe('HEAD')
    expect(JSON.stringify(recorder.read().body)).not.toContain('transactions')
  })
})
