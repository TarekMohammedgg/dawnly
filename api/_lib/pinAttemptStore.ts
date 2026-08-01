import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  evaluateLockout,
  nextStateAfterFailure,
  resetPinAttemptState,
  type LockoutDecision,
  type PinAttemptState,
} from './pinLockout.js'

const validTimestampSchema = z.string().refine(
  (timestamp) => !Number.isNaN(Date.parse(timestamp)),
  'PIN lockout timestamp must be parseable',
)

export type PinAttemptStore = {
  read(): Promise<PinAttemptState>
  recordAttempt(accepted: boolean, now: Date): Promise<PinAttemptDecision>
}

export const pinAttemptDecisionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('accepted') }),
  z.object({ status: z.literal('invalid') }),
  z.object({
    status: z.literal('locked'),
    locked_until: validTimestampSchema,
    retry_after_seconds: z.number().int().positive(),
  }),
])

export type PinAttemptDecision = z.infer<typeof pinAttemptDecisionSchema>

function toLockedDecision(
  lockout: Extract<LockoutDecision, { status: 'locked' }>,
): PinAttemptDecision {
  return {
    status: 'locked',
    locked_until: lockout.lockedUntil,
    retry_after_seconds: lockout.retryAfterSeconds,
  }
}

function recordMemoryFailure(
  state: PinAttemptState,
  now: Date,
): { state: PinAttemptState; decision: PinAttemptDecision } {
  const nextState = nextStateAfterFailure(state, now)
  const lockout = evaluateLockout(nextState, now)
  const decision =
    lockout.status === 'locked'
      ? toLockedDecision(lockout)
      : { status: 'invalid' as const }
  return { state: nextState, decision }
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

    async recordAttempt(accepted, now) {
      const { data, error } = await client.rpc('dawnly_record_pin_attempt', {
        p_pin_accepted: accepted,
        p_attempt_at: now.toISOString(),
      })

      if (error) {
        throw new Error(`Failed to record PIN attempt: ${error.message}`)
      }

      return pinAttemptDecisionSchema.parse(data)
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
    async recordAttempt(accepted, now) {
      const lockout = evaluateLockout(state, now)
      if (lockout.status === 'locked') {
        return toLockedDecision(lockout)
      }

      if (accepted) {
        state = resetPinAttemptState()
        return { status: 'accepted' }
      }

      const failure = recordMemoryFailure(state, now)
      state = failure.state
      return failure.decision
    },
  }
}
