import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppThemeProvider } from '../../components/AppThemeProvider'
import { AppRouterProvider } from '../../components/AppRouterProvider'
import { AuthSessionProvider } from '../../components/AuthSessionProvider'
import { useAuthSession } from '../../lib/auth/sessionContext'
import { clearLocalDatabase } from '../../lib/local/database'
import {
  cacheServerTransactions,
  readCachedTransactions,
} from '../../lib/local/transactions'
import { sampleTransactions } from '../../test/fixtures/transactions'
import { useEffect, type ReactNode } from 'react'
import { ImportPage } from './ImportPage'
import { SettingsPage } from '../settings/SettingsPage'

function SeedSession({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuthSession()
  useEffect(() => {
    if (session) {
      return
    }
    setSession({
      token: 'test-session-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
  }, [session, setSession])
  return children
}

function renderWithSession(ui: ReactNode) {
  return render(
    <AppThemeProvider>
      <AuthSessionProvider>
        <AppRouterProvider>
          <SeedSession>{ui}</SeedSession>
        </AppRouterProvider>
      </AuthSessionProvider>
    </AppThemeProvider>,
  )
}

afterEach(async () => {
  cleanup()
  await clearLocalDatabase()
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
    vi.fn(async () => {
      throw new TypeError('offline')
    }),
  )
})

describe('Phase 5 CSV import UI', () => {
  it('shows instructions, previews rows, and imports valid offline rows', async () => {
    const user = userEvent.setup()
    renderWithSession(<ImportPage />)

    expect(await screen.findByRole('heading', { name: 'استيراد' })).toBeTruthy()
    expect(
      screen.getByText(/العناوين المقبولة بالضبط: الاسم، النوع، المبلغ، التاريخ، العملة، ملاحظات/),
    ).toBeTruthy()
    expect(screen.getByText(/الفاصل المقبول هو الفاصلة فقط/)).toBeTruthy()

    const csvContent = [
      'الاسم,النوع,المبلغ,التاريخ',
      'منى,ليّا,٨٠,01/08/2026',
      'منى,ليّا,80,01/08/2026',
    ].join('\n')
    await user.upload(
      screen.getByLabelText('ملف CSV'),
      new File([csvContent], 'import.csv', { type: 'text/csv' }),
    )

    expect(await screen.findByText(/صالح 1/)).toBeTruthy()
    expect(screen.getByText(/مكرر 1/)).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: 'تأكيد استيراد الصفوف الصالحة' }),
    )
    await user.click(screen.getByRole('button', { name: 'استيراد' }))

    expect(await screen.findByText(/تم استيراد 1 معاملة/)).toBeTruthy()
    const cached = await readCachedTransactions({})
    expect(cached.some((row) => row.name === 'منى' && row.amount === 80)).toBe(
      true,
    )
  })

  it('exports a CSV backup from settings using local data', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:dawnly-test')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)

    renderWithSession(<SettingsPage />)

    expect(await screen.findByRole('heading', { name: 'الإعدادات' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'تصدير CSV' }))
    expect(await screen.findByText(/تم تصدير 3 معاملة/)).toBeTruthy()
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })
})
