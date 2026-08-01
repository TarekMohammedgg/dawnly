import {
  AI_EXTRACT_RATE_LIMIT,
  AI_EXTRACT_RATE_WINDOW_MS,
} from './aiConfig.ts'

type RateBucket = {
  count: number
  windowStart: number
}

const buckets = new Map<string, RateBucket>()

/**
 * Sliding-window rate limit keyed by opaque session token (or other id).
 * Returns true when the request is allowed.
 */
export function allowAiExtractRequest(
  key: string,
  nowMs = Date.now(),
): boolean {
  const existing = buckets.get(key)
  if (!existing || nowMs - existing.windowStart >= AI_EXTRACT_RATE_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: nowMs })
    return true
  }

  if (existing.count >= AI_EXTRACT_RATE_LIMIT) {
    return false
  }

  existing.count += 1
  return true
}

/** Test helper — clears in-memory buckets. */
export function resetAiExtractRateLimit(): void {
  buckets.clear()
}
