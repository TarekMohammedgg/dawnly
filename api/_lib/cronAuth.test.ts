/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { hasValidCronSecret } from './cronAuth'

describe('cron secret authentication', () => {
  it.each([
    { presented: 'cron-secret', expected: 'cron-secret', valid: true },
    { presented: 'wrong-secret', expected: 'cron-secret', valid: false },
    { presented: undefined, expected: 'cron-secret', valid: false },
    { presented: 'cron-secret', expected: '', valid: false },
  ])('accepts only an exact configured secret', ({ presented, expected, valid }) => {
    expect(hasValidCronSecret(presented, expected)).toBe(valid)
  })
})
