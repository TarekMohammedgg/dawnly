import { createHash, timingSafeEqual } from 'node:crypto'

export const CRON_SECRET_HEADER = 'x-dawnly-cron-secret'

export function readCronSecret(
  source: NodeJS.ProcessEnv = process.env,
): string {
  const secret = source.DAWNLY_CRON_SECRET ?? ''
  if (!secret) {
    throw new Error('Missing DAWNLY_CRON_SECRET')
  }
  return secret
}

export function hasValidCronSecret(
  presentedSecret: string | undefined,
  expectedSecret: string,
): boolean {
  if (!presentedSecret || !expectedSecret) {
    return false
  }

  // Compare fixed-size digests so the secret length is not exposed by the comparison.
  const presentedDigest = createHash('sha256').update(presentedSecret).digest()
  const expectedDigest = createHash('sha256').update(expectedSecret).digest()
  return timingSafeEqual(presentedDigest, expectedDigest)
}
