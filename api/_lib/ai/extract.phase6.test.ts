/** @vitest-environment node */
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  EXTRACT_REQUEST_MAX_BYTES,
  EXTRACT_TRANSCRIPT_MAX_LENGTH,
  extractTransactionDraftSchema,
  extractTransactionRequestSchema,
  extractTransactionResponseSchema,
} from '../../../src/types/api'
import { isJsonRequestTooLarge } from '../http'
import { OPENROUTER_MODEL, MINIMAX_MODEL } from './aiConfig'
import { extractWithMiniMax } from './miniMaxExtract'
import { extractWithOpenRouter } from './openRouterExtract'
import { parseExtractionContent } from './parseExtraction'
import { allowAiExtractRequest } from './rateLimit'

describe('parseExtractionContent', () => {
  it('parses JSON and forces EGP currency', () => {
    expect(
      parseExtractionContent(
        '{"name":"أحمد","direction":"payable","amount":50,"notes":null,"transaction_date":null,"currency":"USD"}',
      ),
    ).toEqual({
      name: 'أحمد',
      direction: 'payable',
      amount: 50,
      notes: null,
      transaction_date: null,
      currency: 'EGP',
    })
  })

  it('keeps zero amounts and strips markdown fences', () => {
    expect(
      parseExtractionContent(
        '```json\n{"name":"سارة","direction":"maybe","amount":0,"notes":"سكر","transaction_date":"bad","currency":"EGP"}\n```',
      ),
    ).toEqual({
      name: 'سارة',
      direction: null,
      amount: 0,
      notes: 'سكر',
      transaction_date: null,
      currency: 'EGP',
    })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseExtractionContent('not-json')).toThrow('invalid_json')
  })
})

describe('extract request/response contracts', () => {
  it('limits transcript length and validates drafts', () => {
    expect(
      extractTransactionRequestSchema.safeParse({ transcript: 'أحمد عليه ٥٠' })
        .success,
    ).toBe(true)
    expect(
      extractTransactionRequestSchema.safeParse({
        transcript: 'x'.repeat(EXTRACT_TRANSCRIPT_MAX_LENGTH + 1),
      }).success,
    ).toBe(false)

    expect(
      extractTransactionDraftSchema.parse({
        name: null,
        direction: null,
        amount: null,
        notes: null,
        transaction_date: null,
        currency: 'EGP',
      }),
    ).toMatchObject({ currency: 'EGP' })

    expect(
      extractTransactionResponseSchema.parse({
        transcript: 'أحمد عليه ٥٠',
        draft: {
          name: 'أحمد',
          direction: 'payable',
          amount: 50,
          notes: null,
          transaction_date: null,
          currency: 'EGP',
        },
        confidence: null,
      }).draft.name,
    ).toBe('أحمد')
  })

  it('rejects unexpected fields and oversized JSON bodies', () => {
    expect(
      extractTransactionRequestSchema.safeParse({
        transcript: 'أحمد',
        unexpected: 'ignored',
      }).success,
    ).toBe(false)
    expect(
      isJsonRequestTooLarge(
        { transcript: 'x'.repeat(EXTRACT_REQUEST_MAX_BYTES) },
        undefined,
        EXTRACT_REQUEST_MAX_BYTES,
      ),
    ).toBe(true)
  })
})

describe('provider adapters', () => {
  it('calls OpenRouter with the pinned Luna model', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content:
                '{"name":"منى","direction":"receivable","amount":75,"transaction_date":"2026-08-01","currency":"EGP"}',
            },
          },
        ],
      }),
    )

    const draft = await extractWithOpenRouter('sk-or-test', 'منى ليّا ٧٥', fetchImpl)

    expect(draft).toMatchObject({
      name: 'منى',
      direction: 'receivable',
      amount: 75,
      transaction_date: '2026-08-01',
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as { model: string }
    expect(body.model).toBe(OPENROUTER_MODEL)
  })

  it('calls MiniMax Token Plan with MiniMax-M3 and thinking disabled', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content:
                '{"name":"كريم","direction":"payable","amount":20,"transaction_date":null,"currency":"EGP"}',
            },
          },
        ],
      }),
    )

    const draft = await extractWithMiniMax('sk-cp-test', 'كريم عليه ٢٠', fetchImpl)

    expect(draft).toMatchObject({
      name: 'كريم',
      direction: 'payable',
      amount: 20,
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as {
      model: string
      thinking: { type: string }
    }
    expect(body.model).toBe(MINIMAX_MODEL)
    expect(body.thinking).toEqual({ type: 'disabled' })
  })
})

describe('AI extract rate limit', () => {
  it('hashes the session token before asking the server to allow a request', async () => {
    const rpc = vi.fn(async () => ({
      data: { allowed: true, retry_after_seconds: 0 },
      error: null,
    }))
    const sessionToken = 'session-a'
    const client = { rpc } as unknown as SupabaseClient

    const decision = await allowAiExtractRequest(
      client,
      sessionToken,
      new Date('2026-08-01T12:00:00.000Z'),
    )

    expect(decision).toEqual({ allowed: true, retry_after_seconds: 0 })
    expect(rpc).toHaveBeenCalledWith('dawnly_allow_ai_extract', {
      p_key_hash: createHash('sha256').update(sessionToken).digest('hex'),
      p_request_at: '2026-08-01T12:00:00.000Z',
    })
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain(sessionToken)
  })

  it('returns the server retry interval when the session is throttled', async () => {
    const rpc = vi.fn(async () => ({
      data: { allowed: false, retry_after_seconds: 37 },
      error: null,
    }))
    const client = { rpc } as unknown as SupabaseClient

    await expect(
      allowAiExtractRequest(client, 'session-a'),
    ).resolves.toEqual({ allowed: false, retry_after_seconds: 37 })
  })
})
