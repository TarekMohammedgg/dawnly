export type SafeFailureDetails = {
  route?: string
  operation?: string
  provider?: string
  status?: number
  code?: string
  errorType?: string
}

export function errorType(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'unknown'
}

export function logServerFailure(
  event: string,
  details: SafeFailureDetails = {},
): void {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([, detailValue]) => detailValue !== undefined),
  )
  console.error(`[dawnly] ${JSON.stringify({ event, ...safeDetails })}`)
}
