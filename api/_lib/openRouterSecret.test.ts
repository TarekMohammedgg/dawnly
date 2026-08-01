/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  readAiKeyStatus,
  resolveAiApiKey,
  resolveOpenRouterApiKey,
  setAiProvider,
  upsertAiKeyInVault,
} from './openRouterSecret'

function mockClient(rpcImpl: SupabaseClient['rpc']): SupabaseClient {
  return {
    rpc: rpcImpl,
  } as unknown as SupabaseClient
}

const configuredStatus = {
  provider: 'openrouter' as const,
  openrouter: {
    configured: true,
    updated_at: '2026-08-01T00:00:00.000Z',
  },
  minimax: { configured: false },
}

describe('openRouterSecret', () => {
  it('reads dual-provider status without exposing plaintext', async () => {
    const client = mockClient(
      vi.fn(async () => ({
        data: configuredStatus,
        error: null,
      })) as unknown as SupabaseClient['rpc'],
    )

    await expect(readAiKeyStatus(client)).resolves.toEqual(configuredStatus)
  })

  it('upserts a vault secret for the selected provider', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        ...configuredStatus,
        provider: 'minimax',
        minimax: {
          configured: true,
          updated_at: '2026-08-01T00:00:00.000Z',
        },
      },
      error: null,
    }))

    const client = mockClient(rpc as unknown as SupabaseClient['rpc'])

    await expect(
      upsertAiKeyInVault(client, 'minimax', 'sk-cp-test-key'),
    ).resolves.toMatchObject({
      provider: 'minimax',
      minimax: { configured: true },
    })

    expect(rpc).toHaveBeenCalledWith('dawnly_upsert_ai_key', {
      provider: 'minimax',
      new_secret: 'sk-cp-test-key',
    })
  })

  it('sets the active AI provider in vault', async () => {
    const rpc = vi.fn(async () => ({
      data: { ...configuredStatus, provider: 'minimax' },
      error: null,
    }))

    const client = mockClient(rpc as unknown as SupabaseClient['rpc'])

    await expect(setAiProvider(client, 'minimax')).resolves.toMatchObject({
      provider: 'minimax',
    })

    expect(rpc).toHaveBeenCalledWith('dawnly_set_ai_provider', {
      provider: 'minimax',
    })
  })

  it('resolves the active provider key preferring vault over env', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...configuredStatus, provider: 'minimax' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: 'vault-minimax-key',
        error: null,
      })

    const client = mockClient(rpc as unknown as SupabaseClient['rpc'])

    await expect(
      resolveAiApiKey(client, {
        MINIMAX_API_KEY: 'env-fallback',
      }),
    ).resolves.toEqual({
      provider: 'minimax',
      key: 'vault-minimax-key',
      source: 'vault',
    })
  })

  it('falls back to env when vault has no key for the active provider', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: configuredStatus,
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: null,
      })

    const client = mockClient(rpc as unknown as SupabaseClient['rpc'])

    await expect(
      resolveAiApiKey(client, {
        OPENROUTER_API_KEY: 'env-only-key',
      }),
    ).resolves.toEqual({
      provider: 'openrouter',
      key: 'env-only-key',
      source: 'env',
    })
  })

  it('resolves OpenRouter-only helper from vault then env', async () => {
    const client = mockClient(
      vi.fn(async () => ({
        data: null,
        error: null,
      })) as unknown as SupabaseClient['rpc'],
    )

    await expect(
      resolveOpenRouterApiKey(client, {
        OPENROUTER_API_KEY: 'env-or-key',
      }),
    ).resolves.toEqual({ key: 'env-or-key', source: 'env' })
  })
})
