/** @vitest-environment node */
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY

describe('live Supabase anonymous access', () => {
  it.skipIf(!url || !publishableKey)(
    'rejects publishable-key reads on transactions via RLS',
    async () => {
      const client = createClient(url!, publishableKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data, error } = await client.from('transactions').select('id')

      // Secure either way: PostgREST may error on RLS deny, or return zero rows.
      expect(error !== null || data === null || data.length === 0).toBe(true)
      expect(Array.isArray(data) ? data.length : 0).toBe(0)
    },
  )
})
