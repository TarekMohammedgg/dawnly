import type { ApiErrorCode, ApiErrorResponse } from '../../src/types/api.js'

export type HeaderResponse = {
  setHeader(name: string, value: string): unknown
}

export function setNoStore(response: HeaderResponse): void {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Pragma', 'no-cache')
}

export function isJsonRequestTooLarge(
  body: unknown,
  declaredLength: string | undefined,
  maxBytes: number,
): boolean {
  const contentLength = declaredLength ? Number(declaredLength) : NaN
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return true
  }

  const serializedBody = JSON.stringify(body)
  if (serializedBody === undefined) {
    return false
  }

  return new TextEncoder().encode(serializedBody).byteLength > maxBytes
}

export function json(
  status: number,
  body: unknown,
): { status: number; body: unknown } {
  return { status, body }
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): { status: number; body: ApiErrorResponse } {
  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
  }
}

export function readBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }

  return token
}
