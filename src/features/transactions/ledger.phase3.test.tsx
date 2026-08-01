import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
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
import { sampleTransactions } from '../../test/fixtures/transactions'
import type { ApiTransaction } from '../../types/api'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.history.pushState({}, '', '/')
  vi.unstubAllGlobals()
})

function toApiRow(
  row: (typeof sampleTransactions)[number],
): ApiTransaction {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction,
    amount: row.amount,
    notes: row.notes ?? null,
    transaction_date: row.transactionDate,
    currency: row.currency,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

function mockLedgerApis(options?: {
  transactions?: ApiTransaction[]
  onCreate?: (body: unknown) => Response | Promise<Response>
  onDelete?: (id: string) => Response | Promise<Response>
  onPatch?: (id: string, body: unknown) => Response | Promise<Response>
}) {
  let rows = [...(options?.transactions ?? sampleTransactions.map(toApiRow))]

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (url.includes('/api/auth/verify-pin')) {
      return Response.json({
        token: 'test-session-token',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
    }

    if (url.includes('/api/settings/ai-key')) {
      return Response.json({
        provider: 'openrouter',
        openrouter: { configured: false },
        minimax: { configured: false },
      })
    }

    const byId = url.match(/\/api\/transactions\/([0-9a-f-]{36})/i)
    if (byId) {
      const id = byId[1] ?? ''
      if (method === 'DELETE') {
        if (options?.onDelete) {
          return options.onDelete(id)
        }
        rows = rows.filter((row) => row.id !== id)
        return new Response(null, { status: 204 })
      }
      if (method === 'PATCH') {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        if (options?.onPatch) {
          return options.onPatch(id, body)
        }
        const index = rows.findIndex((row) => row.id === id)
        if (index < 0) {
          return Response.json(
            { error: { code: 'not_found', message: 'المعاملة غير موجودة' } },
            { status: 404 },
          )
        }
        const current = rows[index]!
        const updated: ApiTransaction = {
          ...current,
          ...body,
          name: body.name ?? current.name,
          updated_at: new Date().toISOString(),
        }
        rows[index] = updated
        return Response.json({ transaction: updated })
      }
    }

    if (url.includes('/api/transactions')) {
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        if (options?.onCreate) {
          return options.onCreate(body)
        }
        const created: ApiTransaction = {
          id: '44444444-4444-4444-8444-444444444444',
          name: String(body.name).trim(),
          direction: body.direction,
          amount: body.amount,
          notes: body.notes ?? null,
          transaction_date: body.transaction_date,
          currency: 'EGP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        rows = [created, ...rows]
        return Response.json({ transaction: created }, { status: 201 })
      }

      const query = new URL(url, 'http://localhost').searchParams
      let filtered = [...rows]
      const name = query.get('name')
      if (name) {
        filtered = filtered.filter((row) =>
          row.name.toLowerCase().includes(name.trim().toLowerCase()),
        )
      }
      const direction = query.get('direction')
      if (direction) {
        filtered = filtered.filter((row) => row.direction === direction)
      }
      const amount = query.get('amount')
      if (amount) {
        filtered = filtered.filter((row) => row.amount === Number(amount))
      }
      return Response.json({ transactions: filtered })
    }

    return new Response('not found', { status: 404 })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function unlockApp(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^الرقم السري$/), '123456')
  await user.click(screen.getByRole('button', { name: 'دخول' }))
  expect(
    await screen.findByRole('navigation', { name: 'التنقل الرئيسي' }),
  ).toBeTruthy()
}

describe('Phase 3 ledger experience', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('shows dashboard totals and blocks ledger data before PIN unlock', async () => {
    mockLedgerApis()
    render(<App />)

    expect(screen.queryByText('ليّا')).toBeNull()
    expect(screen.getByLabelText(/^الرقم السري$/)).toBeTruthy()

    const user = userEvent.setup()
    await unlockApp(user)

    expect(await screen.findByLabelText('إجمالي ليّا')).toBeTruthy()
    expect(screen.getByLabelText('إجمالي عليّا')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'إضافة معاملة' })).toBeTruthy()
  })

  it('validates the manual form and suggests existing Arabic names', async () => {
    mockLedgerApis()
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(await screen.findByRole('button', { name: 'إضافة معاملة' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'حفظ المعاملة' }),
    )

    expect(await within(dialog).findByText('أدخل اسم الشخص')).toBeTruthy()
    expect(within(dialog).getByText('اختر ليّا أو عليّا')).toBeTruthy()

    const nameInput = within(dialog).getByRole('combobox', { name: 'اسم الشخص' })
    await user.type(nameInput, 'أح')
    expect(await screen.findByRole('option', { name: 'أحمد' })).toBeTruthy()
  })

  it('creates a transaction and surfaces duplicate errors', async () => {
    mockLedgerApis({
      onCreate: () =>
        Response.json(
          {
            error: {
              code: 'duplicate',
              message: 'هذه المعاملة موجودة بالفعل',
            },
          },
          { status: 409 },
        ),
    })
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(await screen.findByRole('button', { name: 'إضافة معاملة' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByRole('combobox', { name: 'اسم الشخص' }),
      'منى',
    )
    await user.click(within(dialog).getByRole('button', { name: 'ليّا' }))
    await user.type(within(dialog).getByLabelText('المبلغ'), '75')
    await user.click(
      within(dialog).getByRole('button', { name: 'حفظ المعاملة' }),
    )

    expect(
      await within(dialog).findByText('هذه المعاملة موجودة بالفعل'),
    ).toBeTruthy()
  })

  it('filters the ledger through the URL query string', async () => {
    mockLedgerApis()
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'السجل' }))
    expect(await screen.findByRole('heading', { name: 'السجل' })).toBeTruthy()

    await user.type(screen.getByLabelText('بحث بالاسم'), 'أحمد')
    await user.click(screen.getByRole('button', { name: 'تطبيق' }))

    expect(window.location.search).toContain('name=')
    await waitFor(() => {
      expect(screen.queryByText('سارة')).toBeNull()
    })
    expect(screen.getAllByText('أحمد').length).toBeGreaterThan(0)
  })

  it('edits a transaction and requires delete confirmation', async () => {
    const fetchMock = mockLedgerApis()
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'السجل' }))
    expect(await screen.findByLabelText('قائمة المعاملات')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'حذف معاملة سارة' }))
    expect(screen.getByText(/هل تريد حذف معاملة سارة/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'إلغاء' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByText('سارة')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'حذف معاملة سارة' }))
    await user.click(screen.getByRole('button', { name: 'حذف' }))
    await waitFor(() => {
      expect(screen.queryByText('سارة')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    const editButtons = await screen.findAllByRole('button', {
      name: 'تعديل معاملة أحمد',
    })
    await user.click(editButtons[0]!)
    const dialog = await screen.findByRole('dialog')
    const amountInput = within(dialog).getByLabelText('المبلغ')
    await user.clear(amountInput)
    await user.type(amountInput, '300')
    await user.click(
      within(dialog).getByRole('button', { name: 'حفظ التعديلات' }),
    )

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).includes(
              '/api/transactions/11111111-1111-4111-8111-111111111111',
            ) && String(init?.method ?? '').toUpperCase() === 'PATCH',
        ),
      ).toBe(true)
    })
  }, 15_000)

  it('opens person detail with separate direction totals and net', async () => {
    mockLedgerApis()
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'السجل' }))
    const personButtons = await screen.findAllByRole('button', {
      name: 'عرض تفاصيل أحمد',
    })
    await user.click(personButtons[0]!)

    expect(await screen.findByRole('heading', { name: 'أحمد' })).toBeTruthy()
    expect(window.location.pathname).toBe('/person')
    expect(window.location.search).toContain('name=')
    expect(screen.getByLabelText('إجمالي ليّا').textContent).toContain('ج.م')
    expect(screen.getByText('الصافي')).toBeTruthy()
  })

  it('opens person detail from the people grid', async () => {
    mockLedgerApis()
    const user = userEvent.setup()
    render(<App />)
    await unlockApp(user)

    await user.click(screen.getByRole('button', { name: 'الأشخاص' }))
    expect(await screen.findByRole('heading', { name: 'الأشخاص' })).toBeTruthy()

    await user.click(
      await screen.findByRole('button', { name: 'عرض سجل أحمد' }),
    )

    expect(await screen.findByRole('heading', { name: 'أحمد' })).toBeTruthy()
    expect(window.location.pathname).toBe('/person')
    expect(window.location.search).toContain('name=')
  })
})
