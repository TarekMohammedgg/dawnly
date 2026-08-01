import type { IncomingHttpHeaders } from 'node:http'

export type DawnlyRequest = {
  method?: string
  headers: IncomingHttpHeaders
  query: Record<string, string | string[] | undefined>
  body?: unknown
}

export type DawnlyResponse = {
  setHeader(
    name: string,
    value: string | number | readonly string[],
  ): DawnlyResponse
  status(code: number): DawnlyResponse
  json(body: unknown): DawnlyResponse
  end(body?: string): DawnlyResponse
}
