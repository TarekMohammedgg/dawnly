import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const aiRateLimitDecisionSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
})

export type AiRateLimitDecision = z.infer<typeof aiRateLimitDecisionSchema>

export async function allowAiExtractRequest(
  client: SupabaseClient,
  sessionToken: string,
  now = new Date(),
): Promise<AiRateLimitDecision> {
  const sessionTokenHash = createHash('sha256')
    .update(sessionToken, 'utf8')
    .digest('hex')
  const { data, error } = await client.rpc('dawnly_allow_ai_extract', {
    p_key_hash: sessionTokenHash,
    p_request_at: now.toISOString(),
  })

  if (error) {
    throw new Error(`Failed to record AI extraction request: ${error.message}`)
  }

  return aiRateLimitDecisionSchema.parse(data)
}
