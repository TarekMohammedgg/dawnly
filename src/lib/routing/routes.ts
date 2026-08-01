export const APP_ROUTES = {
  dashboard: '/',
  ledger: '/ledger',
  import: '/import',
  settings: '/settings',
  person: '/person',
} as const

export type AppRouteId = keyof typeof APP_ROUTES

export type AppPath = (typeof APP_ROUTES)[AppRouteId]

export const NAV_ITEMS: ReadonlyArray<{
  id: Exclude<AppRouteId, 'person'>
  path: (typeof APP_ROUTES)[Exclude<AppRouteId, 'person'>]
  label: string
}> = [
  { id: 'dashboard', path: APP_ROUTES.dashboard, label: 'الرئيسية' },
  { id: 'ledger', path: APP_ROUTES.ledger, label: 'السجل' },
  { id: 'import', path: APP_ROUTES.import, label: 'استيراد' },
  { id: 'settings', path: APP_ROUTES.settings, label: 'الإعدادات' },
]

export function pathToRouteId(pathname: string): AppRouteId {
  if (pathname === APP_ROUTES.person) {
    return 'person'
  }

  const match = NAV_ITEMS.find((item) => item.path === pathname)
  return match?.id ?? 'dashboard'
}

export function personPath(name: string): string {
  const params = new URLSearchParams({ name })
  return `${APP_ROUTES.person}?${params.toString()}`
}
