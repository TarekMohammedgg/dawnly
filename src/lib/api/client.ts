import type { ApiErrorResponse } from '../../types/api'
import { errorType, logClientFailure } from '../observability'

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, body: ApiErrorResponse | null, fallback: string) {
    super(body?.error.message ?? fallback)
    this.name = 'ApiClientError'
    this.status = status
    this.code = body?.error.code ?? 'internal_error'
  }
}

async function parseError(response: Response): Promise<ApiErrorResponse | null> {
  try {
    return (await response.json()) as ApiErrorResponse
  } catch {
    return null
  }
}

function safeRoute(path: string): string {
  return path.split('?')[0] || '/api'
}

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string
    token?: string | null
    body?: unknown
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (cause) {
    if (cause instanceof TypeError) {
      logClientFailure('api_network_failed', {
        route: safeRoute(path),
        errorType: errorType(cause),
      })
    }
    throw cause
  }

  if (!response.ok) {
    const body = await parseError(response)
    logClientFailure('api_request_failed', {
      route: safeRoute(path),
      status: response.status,
      code: body?.error.code,
    })
    throw new ApiClientError(
      response.status,
      body,
      'تعذر إكمال الطلب',
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}
