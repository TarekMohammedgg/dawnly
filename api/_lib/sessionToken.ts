import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_SECONDS = 60 * 60

export type SessionPayload = {
  iat: number
  exp: number
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export function createSessionToken(
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = SESSION_TTL_SECONDS,
): { token: string; payload: SessionPayload } {
  const payload: SessionPayload = {
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  }
  const encoded = toBase64Url(JSON.stringify(payload))
  const signature = sign(encoded, secret)
  return {
    token: `${encoded}.${signature}`,
    payload,
  }
}

export function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = sign(encoded, secret)
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as SessionPayload
    if (
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSeconds
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
