/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import { requestDawnlyHealth } from './index'

describe('Cloudflare health Cron request', () => {
  it('sends the secret in a header and never in the health URL', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

    await requestDawnlyHealth(
      {
        DAWNLY_PUBLIC_URL: 'https://dawnly.example',
        DAWNLY_CRON_SECRET: 'cron-secret',
      },
      fetchMock,
    )

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://dawnly.example/api/health/supabase')
    expect(url).not.toContain('cron-secret')
    expect(init.headers).toEqual({ 'x-dawnly-cron-secret': 'cron-secret' })
  })
})
