/** @vitest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  apiErrorSchema,
  transactionCreateSchema,
  transactionDeleteSchema,
  transactionListQuerySchema,
  transactionUpdateSchema,
  verifyPinRequestSchema,
} from '../../src/types/api'

describe('API contracts', () => {
  it('validates create, update, list, and error payloads', () => {
    expect(
      transactionCreateSchema.parse({
        name: ' أحمد ',
        direction: 'receivable',
        amount: 50,
        transaction_date: '2026-07-28',
      }),
    ).toMatchObject({
      name: 'أحمد',
      currency: 'EGP',
    })

    expect(
      transactionUpdateSchema.safeParse({ amount: 10 }).success,
    ).toBe(true)
    expect(transactionUpdateSchema.safeParse({}).success).toBe(false)

    expect(
      transactionListQuerySchema.parse({
        direction: 'payable',
        amount: '25',
        currency: 'EGP',
      }),
    ).toEqual({
      direction: 'payable',
      amount: 25,
      currency: 'EGP',
    })

    expect(
      apiErrorSchema.parse({
        error: { code: 'unauthorized', message: 'يلزم تسجيل الدخول بالرقم السري' },
      }).error.code,
    ).toBe('unauthorized')
  })

  it('requires exactly six ASCII digit PINs', () => {
    expect(verifyPinRequestSchema.safeParse({ pin: '246810' }).success).toBe(
      true,
    )
    expect(verifyPinRequestSchema.safeParse({ pin: '24681a' }).success).toBe(
      false,
    )
  })

  it('accepts client mutation IDs for all local-first mutation routes', () => {
    const clientMutationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(
      transactionCreateSchema.parse({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'منى',
        direction: 'receivable',
        amount: 75,
        transaction_date: '2026-08-01',
        client_mutation_id: clientMutationId,
      }).client_mutation_id,
    ).toBe(clientMutationId)
    expect(
      transactionUpdateSchema.parse({
        amount: 80,
        client_mutation_id: clientMutationId,
      }).client_mutation_id,
    ).toBe(clientMutationId)
    expect(
      transactionDeleteSchema.parse({
        client_mutation_id: clientMutationId,
      }).client_mutation_id,
    ).toBe(clientMutationId)
  })
})

describe('schema migration', () => {
  it('documents constraints, updated_at trigger, RLS, and lockout cleanup', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000000_transactions_and_pin_lockout.sql',
      ),
      'utf8',
    )

    expect(sql).toContain("CREATE TYPE public.transaction_direction AS ENUM")
    expect(sql).toContain('transactions_name_trimmed_nonempty')
    expect(sql).toContain('transactions_amount_positive_integer')
    expect(sql).toContain('transactions_currency_egp')
    expect(sql).toContain('transactions_dedupe_uidx')
    expect(sql).toContain('transactions_set_updated_at')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('pin_attempt_state')
    expect(sql).toMatch(/Cleanup:|cleanup/i)
  })

  it('documents one-time seed and manual deletion SQL', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000001_seed_sample_transactions.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('Owner cleanup')
    expect(sql).toContain('DELETE FROM public.transactions')
    expect(sql).toContain('11111111-1111-4111-8111-111111111111')
  })

  it('documents Vault RPCs for the OpenRouter API key', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000002_vault_openrouter_secret.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('dawnly_ai_key_status')
    expect(sql).toContain('dawnly_get_ai_key')
    expect(sql).toContain('dawnly_upsert_ai_key')
    expect(sql).toContain('OPENROUTER_API_KEY')
    expect(sql).toContain('GRANT EXECUTE')
    expect(sql).toContain('service_role')
  })

  it('documents dual AI provider Vault RPCs', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000003_ai_providers.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('MINIMAX_API_KEY')
    expect(sql).toContain('AI_PROVIDER')
    expect(sql).toContain('dawnly_set_ai_provider')
    expect(sql).toContain('dawnly_get_ai_key(provider text)')
    expect(sql).toContain('dawnly_upsert_ai_key(provider text, new_secret text)')
    expect(sql).toContain("'openrouter'")
    expect(sql).toContain("'minimax'")
  })

  it('documents amount >= 0 and optional notes with notes-aware dedupe', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000005_amount_zero_and_notes.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('transactions_amount_nonnegative_integer')
    expect(sql).toContain('amount >= 0')
    expect(sql).toContain('ADD COLUMN notes text')
    expect(sql).toContain('transactions_notes_trimmed_or_null')
    expect(sql).toContain('coalesce(notes,')
  })

  it('documents server-only mutation receipts for idempotent replay', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000004_transaction_mutation_receipts.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('transaction_mutation_receipts')
    expect(sql).toContain('client_mutation_id uuid PRIMARY KEY')
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toMatch(/server-only idempotency/i)
  })

  it('documents atomic server-only authentication and AI rate limiting', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260801000006_security_hardening.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('dawnly_record_pin_attempt')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("INTERVAL '60 seconds'")
    expect(sql).toContain('ai_extract_rate_limits')
    expect(sql).toContain('dawnly_allow_ai_extract')
    expect(sql).toContain("'^[0-9a-f]{64}$'")
    expect(sql).toContain('REVOKE ALL ON FUNCTION')
    expect(sql).toContain('GRANT EXECUTE')
  })
})

describe('HTTP security configuration', () => {
  it('keeps framing, CSP, and API cache protections enabled', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      headers: Array<{
        source: string
        headers: Array<{ key: string; value: string }>
      }>
    }
    const pageHeaders = config.headers.find((rule) => rule.source === '/(.*)')
    const apiHeaders = config.headers.find((rule) => rule.source === '/api/(.*)')

    expect(pageHeaders?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Frame-Options', value: 'DENY' },
        expect.objectContaining({ key: 'Content-Security-Policy' }),
      ]),
    )
    expect(apiHeaders?.headers).toEqual(
      expect.arrayContaining([
        { key: 'Cache-Control', value: 'no-store, max-age=0' },
        { key: 'Pragma', value: 'no-cache' },
      ]),
    )
  })
})
