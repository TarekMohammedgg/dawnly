import { createContext, useContext } from 'react'
import type { AppPath, AppRouteId } from './routes'

export type NavigateOptions = {
  search?: string
  replace?: boolean
}

export type RouterContextValue = {
  routeId: AppRouteId
  path: AppPath
  search: string
  navigate: (path: AppPath | string, options?: NavigateOptions) => void
  setSearchParams: (
    params: URLSearchParams | Record<string, string | undefined>,
    options?: { replace?: boolean },
  ) => void
}

export const RouterContext = createContext<RouterContextValue | null>(null)

export function useAppRouter(): RouterContextValue {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useAppRouter must be used within AppRouterProvider')
  }
  return context
}
