import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import type {
  DawnlyRequest,
  DawnlyResponse,
} from '../api/_lib/platformTypes.ts'
import { errorType, logServerFailure } from '../api/_lib/observability.ts'

type ApiHandler = (
  request: DawnlyRequest,
  response: DawnlyResponse,
) => unknown | Promise<unknown>

/** Load `.env` files without dotenv-expand so `$` in hashes stays literal. */
function loadEnvFileLiteral(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        let value = line.slice(index + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        return [line.slice(0, index).trim(), value]
      }),
  )
}

function applyLocalEnv(root: string) {
  const merged = {
    ...loadEnvFileLiteral(resolve(root, '.env')),
    ...loadEnvFileLiteral(resolve(root, '.env.local')),
  }

  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return undefined
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function createResponse(res: ServerResponse): DawnlyResponse {
  let statusCode = 200

  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      res.setHeader(name, value)
      return response
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
      }
      res.end(JSON.stringify(body))
      return response
    },
    end(body?: string) {
      res.statusCode = statusCode
      res.end(body)
      return response
    },
    get statusCode() {
      return statusCode
    },
    set statusCode(code: number) {
      statusCode = code
      res.statusCode = code
    },
  }

  return response as unknown as DawnlyResponse
}

async function resolveHandler(
  urlPath: string,
): Promise<{ handler: ApiHandler; params: Record<string, string> } | null> {
  if (urlPath === '/api/auth/verify-pin') {
    const mod = await import('../api/auth/verify-pin.ts')
    return { handler: mod.default, params: {} }
  }

  if (urlPath === '/api/settings/ai-key') {
    const mod = await import('../api/settings/ai-key.ts')
    return { handler: mod.default, params: {} }
  }

  if (urlPath === '/api/ai/extract-transaction') {
    const mod = await import('../api/ai/extract-transaction.ts')
    return { handler: mod.default, params: {} }
  }

  if (urlPath === '/api/health/supabase') {
    const mod = await import('../api/health/supabase.ts')
    return { handler: mod.default, params: {} }
  }

  if (urlPath === '/api/transactions' || urlPath === '/api/transactions/') {
    const mod = await import('../api/transactions/index.ts')
    return { handler: mod.default, params: {} }
  }

  const transactionMatch = urlPath.match(
    /^\/api\/transactions\/([0-9a-f-]{36})$/i,
  )
  if (transactionMatch) {
    // Import the non-bracketed module — Vite's native config loader cannot
    // resolve paths that contain `[id]` (Vercel dynamic-route filename).
    const mod = await import('../api/transactions/transaction-id.ts')
    return {
      handler: mod.default,
      params: { id: transactionMatch[1] ?? '' },
    }
  }

  return null
}

/** Serves Vercel-style `/api/*` handlers during `vite` local development. */
export function dawnlyApiPlugin(): Plugin {
  return {
    name: 'dawnly-api',
    configureServer(server) {
      applyLocalEnv(server.config.root)

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) {
          next()
          return
        }

        try {
          const urlPath = url.split('?')[0] ?? url
          const resolved = await resolveHandler(urlPath)
          if (!resolved) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                error: {
                  code: 'not_found',
                  message: 'المسار غير موجود',
                },
              }),
            )
            return
          }

          const body =
            req.method === 'GET' || req.method === 'HEAD'
              ? undefined
              : await readJsonBody(req)

          const request = Object.assign(req, {
            body,
            query: {
              ...Object.fromEntries(
                new URL(url, 'http://localhost').searchParams,
              ),
              ...resolved.params,
            },
            cookies: {},
          }) as unknown as DawnlyRequest

          await resolved.handler(request, createResponse(res))
        } catch (cause) {
          logServerFailure('local_api_proxy_failed', {
            route: url.split('?')[0] ?? '/api',
            status: 500,
            errorType: errorType(cause),
          })
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(
              JSON.stringify({
                error: {
                  code: 'internal_error',
                  message: 'تعذر إكمال الطلب على الخادم المحلي',
                },
              }),
            )
          }
        }
      })
    },
  }
}
