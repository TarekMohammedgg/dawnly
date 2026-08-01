type CronEnvironment = {
  DAWNLY_PUBLIC_URL: string
  DAWNLY_CRON_SECRET: string
}

export function buildHealthUrl(publicUrl: string): string {
  return new URL('/api/health/supabase', publicUrl).toString()
}

function logHealthFailure(details: {
  status?: number
  errorType?: string
}): void {
  console.error(
    JSON.stringify({
      event: 'dawnly_health_check_failed',
      ...details,
    }),
  )
}

export async function requestDawnlyHealth(
  environment: CronEnvironment,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let response: Response
  try {
    response = await fetchImpl(buildHealthUrl(environment.DAWNLY_PUBLIC_URL), {
      method: 'GET',
      headers: {
        'x-dawnly-cron-secret': environment.DAWNLY_CRON_SECRET,
      },
    })
  } catch (cause) {
    logHealthFailure({
      errorType: cause instanceof Error ? cause.name : 'unknown',
    })
    throw cause
  }

  if (response.ok) {
    return
  }

  logHealthFailure({ status: response.status })
  throw new Error('Dawnly health check failed')
}

export default {
  async scheduled(_controller: unknown, environment: CronEnvironment) {
    await requestDawnlyHealth(environment)
  },
}
