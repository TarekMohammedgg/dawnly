import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type ServerEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseSecretKey: string
  pinHash: string
  sessionSecret: string
}

export function readServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const supabaseUrl =
    source.SUPABASE_URL ?? source.VITE_SUPABASE_URL ?? ''
  const supabasePublishableKey =
    source.SUPABASE_PUBLISHABLE_KEY ??
    source.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ''
  const supabaseSecretKey =
    source.SUPABASE_SECRET_KEY ?? source.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const pinHash = source.DAWNLY_PIN_HASH ?? ''
  const sessionSecret = source.DAWNLY_SESSION_SECRET ?? ''

  if (
    !supabaseUrl ||
    !supabasePublishableKey ||
    !supabaseSecretKey ||
    !pinHash ||
    !sessionSecret
  ) {
    throw new Error('Missing required Dawnly server environment variables')
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    supabaseSecretKey,
    pinHash,
    sessionSecret,
  }
}

/** Public (publishable) client — subject to RLS; used to verify anon denial. */
export function createPublishableClient(env: ServerEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Secret (service-role) client. Call only after Dawnly session auth succeeds.
 * Never expose this client or key to the browser.
 */
export function createSecretClient(env: ServerEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
