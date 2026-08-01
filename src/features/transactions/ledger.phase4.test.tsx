import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { clearLocalDatabase } from '../../lib/local/database'
import { cacheServerTransactions } from '../../lib/local/transactions'
import { sampleTransactions } from '../../test/fixtures/transactions'

afterEach(async () => {
  cleanup()
  await clearLocalDatabase()
  window.history.pushState({}, '', '/')
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  await clearLocalDatabase()
  await cacheServerTransactions(sampleTransactions, {})
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: false,
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/auth/verify-pin')) {
        return Response.json({
          token: 'test-session-token',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        })
      }
      throw new TypeError('offline')
    }),
  )
})

describe('Phase 4 cached read experience', () => {
  it('renders the latest local ledger while the authenticated API is offline', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(/^الرقم السري$/), '123456')
    await user.click(screen.getByRole('button', { name: 'دخول' }))

    expect((await screen.findAllByText('\u0623\u062d\u0645\u062f')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('إجمالي ليّا').textContent).toContain('ج.م')
    expect(screen.getByText(/أنت غير متصل بالإنترنت/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /مزامنة/ })).toBeNull()
  })
})
