import type { SupabaseClient } from '@supabase/supabase-js'
import type { PinAttemptState } from './pinLockout.ts'

export type PinAttemptStore = {
  read(): Promise<PinAttemptState>
  write(state: PinAttemptState): Promise<void>
}

type PinAttemptRow = {
  failed_attempts: number
  locked_until: string | null
}

export function createSupabasePinAttemptStore(
  client: SupabaseClient,
): PinAttemptStore {
  return {
    async read() {
      const { data, error } = await client
        .from('pin_attempt_state')
        .select('failed_attempts, locked_until')
        .eq('id', 'default')
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to read PIN lockout state: ${error.message}`)
      }

      if (!data) {
        return { failedAttempts: 0, lockedUntil: null }
      }

      const row = data as PinAttemptRow
      return {
        failedAttempts: row.failed_attempts,
        lockedUntil: row.locked_until,
      }
    },

    async write(state) {
      const { error } = await client.from('pin_attempt_state').upsert({
        id: 'default',
        failed_attempts: state.failedAttempts,
        locked_until: state.lockedUntil,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        throw new Error(`Failed to write PIN lockout state: ${error.message}`)
      }
    },
  }
}

export function createMemoryPinAttemptStore(
  initial?: PinAttemptState,
): PinAttemptStore {
  let state: PinAttemptState = initial ?? {
    failedAttempts: 0,
    lockedUntil: null,
  }

  return {
    async read() {
      return { ...state }
    },
    async write(next) {
      state = { ...next }
    },
  }
}
