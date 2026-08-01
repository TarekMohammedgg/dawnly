import type { SupabaseClient } from '@supabase/supabase-js'
import { verifySessionToken } from './sessionToken.js'
import { apiError, readBearerToken } from './http.js'
import { createSecretClient, type ServerEnv } from './env.js'

export type AuthenticatedRequest = {
  supabase: SupabaseClient
}

/**
 * Rejects missing/expired/malformed/forged tokens before creating a secret client.
 */
export function requireDawnlySession(
  authorizationHeader: string | undefined,
  env: ServerEnv,
):
  | { ok: true; value: AuthenticatedRequest }
  | { ok: false; response: { status: number; body: unknown } } {
  const token = readBearerToken(authorizationHeader)
  if (!token) {
    return {
      ok: false,
      response: apiError(401, 'unauthorized', 'يلزم تسجيل الدخول بالرقم السري'),
    }
  }

  const payload = verifySessionToken(token, env.sessionSecret)
  if (!payload) {
    return {
      ok: false,
      response: apiError(401, 'unauthorized', 'انتهت الجلسة أو أنها غير صالحة'),
    }
  }

  return {
    ok: true,
    value: {
      supabase: createSecretClient(env),
    },
  }
}
