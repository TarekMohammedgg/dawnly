import type { ApiErrorCode, ApiErrorResponse } from '../../src/types/api.js'

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
