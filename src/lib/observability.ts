export type ClientFailureDetails = {
  route?: string
  operation?: string
  status?: number
  code?: string
  errorType?: string
}

export function errorType(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'unknown'
}

export function logClientFailure(
  event: string,
  details: ClientFailureDetails = {},
): void {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([, detailValue]) => detailValue !== undefined),
  )
  console.error(`[dawnly] ${JSON.stringify({ event, ...safeDetails })}`)
}
