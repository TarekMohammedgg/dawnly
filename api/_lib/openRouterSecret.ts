import type { SupabaseClient } from '@supabase/supabase-js'
import {
  aiKeyStatusSchema,
  aiProviderSchema,
  type AiKeyStatus,
  type AiProvider,
} from '../../src/types/api.ts'

export const OPENROUTER_VAULT_SECRET_NAME = 'OPENROUTER_API_KEY'
export const MINIMAX_VAULT_SECRET_NAME = 'MINIMAX_API_KEY'
export const AI_PROVIDER_VAULT_SECRET_NAME = 'AI_PROVIDER'

export type AiSecretSource = 'vault' | 'env'

function parseAiKeyStatus(data: unknown): AiKeyStatus {
  return aiKeyStatusSchema.parse(data)
}

export async function readAiKeyStatus(
  client: SupabaseClient,
): Promise<AiKeyStatus> {
  const { data, error } = await client.rpc('dawnly_ai_key_status')
  if (error) {
    throw new Error(`Failed to read AI key status: ${error.message}`)
  }

  return parseAiKeyStatus(data)
}

export async function upsertAiKeyInVault(
  client: SupabaseClient,
  provider: AiProvider,
  apiKey: string,
): Promise<AiKeyStatus> {
  const { data, error } = await client.rpc('dawnly_upsert_ai_key', {
    provider,
    new_secret: apiKey,
  })

  if (error) {
    throw new Error(`Failed to save AI key: ${error.message}`)
  }

  return parseAiKeyStatus(data)
}

export async function setAiProvider(
  client: SupabaseClient,
  provider: AiProvider,
): Promise<AiKeyStatus> {
  const { data, error } = await client.rpc('dawnly_set_ai_provider', {
    provider,
  })

  if (error) {
    throw new Error(`Failed to set AI provider: ${error.message}`)
  }

  return parseAiKeyStatus(data)
}

async function readVaultKey(
  client: SupabaseClient,
  provider: AiProvider,
): Promise<string | null> {
  const { data, error } = await client.rpc('dawnly_get_ai_key', { provider })
  if (error || typeof data !== 'string') {
    return null
  }

  const trimmed = data.trim()
  return trimmed.length > 0 ? trimmed : null
}

function envFallbackKey(
  provider: AiProvider,
  envSource: NodeJS.ProcessEnv,
): string | null {
  const raw =
    provider === 'openrouter'
      ? envSource.OPENROUTER_API_KEY
      : envSource.MINIMAX_API_KEY
  const trimmed = raw?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

/**
 * Resolves the active provider's API key for server-side AI calls.
 * Prefer Vault; fall back to matching env for bootstrap/local use.
 * Never send the returned value to the browser.
 */
export async function resolveAiApiKey(
  client: SupabaseClient,
  envSource: NodeJS.ProcessEnv = process.env,
): Promise<{
  provider: AiProvider
  key: string
  source: AiSecretSource
} | null> {
  const status = await readAiKeyStatus(client)
  const provider = aiProviderSchema.parse(status.provider)

  const fromVault = await readVaultKey(client, provider)
  if (fromVault) {
    return { provider, key: fromVault, source: 'vault' }
  }

  const fromEnv = envFallbackKey(provider, envSource)
  if (fromEnv) {
    return { provider, key: fromEnv, source: 'env' }
  }

  return null
}

/** Resolves OpenRouter only (Vault then env). Prefer resolveAiApiKey for active provider. */
export async function resolveOpenRouterApiKey(
  client: SupabaseClient,
  envSource: NodeJS.ProcessEnv = process.env,
): Promise<{ key: string; source: AiSecretSource } | null> {
  const fromVault = await readVaultKey(client, 'openrouter')
  if (fromVault) {
    return { key: fromVault, source: 'vault' }
  }

  const fromEnv = envFallbackKey('openrouter', envSource)
  if (fromEnv) {
    return { key: fromEnv, source: 'env' }
  }

  return null
}
