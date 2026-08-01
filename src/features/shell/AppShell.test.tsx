import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import App from '../../App'
import { AmountDisplay } from '../../components/AmountDisplay'
import { AppThemeProvider } from '../../components/AppThemeProvider'
import { DateDisplay } from '../../components/DateDisplay'
import { sampleTransactions } from '../../test/fixtures/transactions'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.history.pushState({}, '', '/')
  vi.unstubAllGlobals()
})

function mockAuthenticatedApis() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/api/auth/verify-pin')) {
        return Response.json({
          token: 'test-session-token',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        })
      }

      if (url.includes('/api/settings/ai-key')) {
        const requestBody = init?.body ? JSON.parse(String(init.body)) : null
        const requestedProvider =
          requestBody?.provider === 'minimax' ? 'minimax' : 'openrouter'
        return Response.json({
          provider: requestedProvider,
          openrouter: { configured: false },
          minimax: { configured: false },
        })
      }

      if (url.includes('/api/transactions')) {
        return Response.json({ transactions: [] })
      }

      return new Response('not found', { status: 404 })
    }),
  )
}

async function unlockApp(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText(/^الرقم السري$/), '123456')
  await user.click(screen.getByRole('button', { name: 'دخول' }))
  expect(
    await screen.findByRole('navigation', { name: 'التنقل الرئيسي' }),
  ).toBeTruthy()
}

function renderApp() {
  return render(<App />)
}

describe('Dawnly foundation shell', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    mockAuthenticatedApis()
  })

  it('sets RTL document direction and Arabic language', async () => {
    const user = userEvent.setup()
    renderApp()
    await unlockApp(user)

    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('shows Arabic navigation labels', async () => {
    const user = userEvent.setup()
    renderApp()
    await unlockApp(user)

    const nav = screen.getByRole('navigation', { name: 'التنقل الرئيسي' })
    expect(within(nav).getByRole('button', { name: 'الرئيسية' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'السجل' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'الأشخاص' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'الإعدادات' })).toBeTruthy()

    await user.click(within(nav).getByRole('button', { name: 'الأشخاص' }))
    expect(await screen.findByRole('heading', { name: 'الأشخاص' })).toBeTruthy()

    await user.click(within(nav).getByRole('button', { name: 'الإعدادات' }))
    expect(await screen.findByRole('heading', { name: 'الإعدادات' })).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'استيراد CSV' }))
    expect(await screen.findByRole('heading', { name: 'استيراد' })).toBeTruthy()
  })

  it('supports keyboard navigation between routes', async () => {
    const user = userEvent.setup()
    renderApp()
    await unlockApp(user)

    expect(screen.getByRole('heading', { name: 'الرئيسية' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'السجل' }))
    expect(await screen.findByRole('heading', { name: 'السجل' })).toBeTruthy()
    expect(window.location.pathname).toBe('/ledger')

    const settingsButton = screen.getByRole('button', { name: 'الإعدادات' })
    settingsButton.focus()
    expect(document.activeElement).toBe(settingsButton)

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'الإعدادات' })).toBeTruthy()
    expect(window.location.pathname).toBe('/settings')
  })

  it('switches between light and dark themes from settings', async () => {
    const user = userEvent.setup()
    renderApp()
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'الإعدادات' }))

    expect(document.documentElement.dataset.colorMode).toBe('light')

    const themeSwitch = await screen.findByRole('switch', {
      name: 'تبديل الوضع الداكن',
    })
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false')
    await user.click(screen.getByText('الوضع الداكن'))
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false')
    await user.click(themeSwitch)
    expect(document.documentElement.dataset.colorMode).toBe('dark')
    expect(window.localStorage.getItem('dawnly-color-mode')).toBe('dark')
    expect(themeSwitch.getAttribute('aria-checked')).toBe('true')
    // Regression: the active thumb must move right in the RTL page.
    expect(
      getComputedStyle(
        themeSwitch.querySelector('.theme-mode-toggle__thumb')!,
      ).transform,
    ).toBe('translateX(20px)')

    await user.click(themeSwitch)
    expect(document.documentElement.dataset.colorMode).toBe('light')
    expect(window.localStorage.getItem('dawnly-color-mode')).toBe('light')
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false')
    expect(
      getComputedStyle(
        themeSwitch.querySelector('.theme-mode-toggle__thumb')!,
      ).transform,
    ).toBe('translateX(0)')
  })

  it('switches API providers without showing a switch message', async () => {
    const user = userEvent.setup()
    renderApp()
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'الإعدادات' }))
    const minimaxButton = await screen.findByRole('button', { name: 'MiniMax' })
    await user.click(minimaxButton)

    await waitFor(() => {
      expect(minimaxButton.getAttribute('aria-pressed')).toBe('true')
    })
    expect(screen.queryByText(/تم التبديل إلى/)).toBeNull()
  })

  it('keeps the shell usable at a narrow mobile width', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 812,
    })

    const user = userEvent.setup()
    const { container } = renderApp()
    await unlockApp(user)

    expect(screen.getByRole('heading', { name: 'دونلي' })).toBeTruthy()
    expect(
      screen.getByRole('navigation', { name: 'التنقل الرئيسي' }),
    ).toBeTruthy()
    expect(container.querySelector('main')).toBeTruthy()
  })
})

describe('shared display components', () => {
  it('renders EGP amounts and DD/MM/YYYY dates', () => {
    const sample = sampleTransactions[0]

    render(
      <AppThemeProvider>
        <AmountDisplay amount={sample.amount} />
        <DateDisplay isoDate={sample.transactionDate} />
      </AppThemeProvider>,
    )

    expect(screen.getByLabelText(/المبلغ/).textContent).toContain('ج.م')
    expect(screen.getByText('28/07/2026')).toBeTruthy()
  })
})
