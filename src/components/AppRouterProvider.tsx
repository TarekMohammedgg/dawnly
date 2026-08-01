import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  RouterContext,
  type RouterContextValue,
} from '../lib/routing/routerContext'
import {
  APP_ROUTES,
  pathToRouteId,
  type AppPath,
} from '../lib/routing/routes'

type LocationState = {
  path: AppPath
  search: string
}

function readLocation(): LocationState {
  const pathname = window.location.pathname
  const routeId = pathToRouteId(pathname)
  return {
    path: APP_ROUTES[routeId],
    search: window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search,
  }
}

function toSearchString(
  params: URLSearchParams | Record<string, string | undefined>,
): string {
  if (params instanceof URLSearchParams) {
    return params.toString()
  }

  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      next.set(key, value)
    }
  }
  return next.toString()
}

type AppRouterProviderProps = {
  children: ReactNode
}

export function AppRouterProvider({ children }: AppRouterProviderProps) {
  const [location, setLocation] = useState<LocationState>(readLocation)

  useEffect(() => {
    const onPopState = () => {
      setLocation(readLocation())
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback(
    (nextPath: AppPath | string, options?: { search?: string; replace?: boolean }) => {
      const [pathnamePart, searchPart] = nextPath.split('?')
      const pathname = pathnamePart || APP_ROUTES.dashboard
      const routeId = pathToRouteId(pathname)
      const path = APP_ROUTES[routeId]
      const search =
        options?.search !== undefined
          ? options.search.replace(/^\?/, '')
          : (searchPart ?? '')

      const url = search ? `${path}?${search}` : path
      if (options?.replace) {
        window.history.replaceState({}, '', url)
      } else if (
        window.location.pathname !== path ||
        window.location.search.replace(/^\?/, '') !== search
      ) {
        window.history.pushState({}, '', url)
      }

      setLocation({ path, search })
    },
    [],
  )

  const setSearchParams = useCallback(
    (
      params: URLSearchParams | Record<string, string | undefined>,
      options?: { replace?: boolean },
    ) => {
      const search = toSearchString(params)
      const url = search ? `${location.path}?${search}` : location.path
      if (options?.replace) {
        window.history.replaceState({}, '', url)
      } else {
        window.history.pushState({}, '', url)
      }
      setLocation({ path: location.path, search })
    },
    [location.path],
  )

  const value = useMemo<RouterContextValue>(
    () => ({
      routeId: pathToRouteId(location.path),
      path: location.path,
      search: location.search,
      navigate,
      setSearchParams,
    }),
    [location.path, location.search, navigate, setSearchParams],
  )

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  )
}
