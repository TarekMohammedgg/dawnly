import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import {
  ColorModeContext,
  type ColorModeContextValue,
} from '../lib/theme/colorModeContext'
import {
  createAppTheme,
  type ColorMode,
} from '../lib/theme/createAppTheme'
import { createRtlCache } from '../lib/theme/rtlCache'

const COLOR_MODE_STORAGE_KEY = 'dawnly-color-mode'

function readStoredMode(): ColorMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

type AppThemeProviderProps = {
  children: ReactNode
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setModeState] = useState<ColorMode>(readStoredMode)
  const rtlCache = useMemo(() => createRtlCache(), [])
  const theme = useMemo(() => createAppTheme(mode), [mode])

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl')
    document.documentElement.lang = 'ar'
    document.documentElement.dataset.colorMode = mode
  }, [mode])

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next)
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next)
  }, [])

  const value = useMemo<ColorModeContextValue>(
    () => ({ mode, setMode }),
    [mode, setMode],
  )

  return (
    <ColorModeContext.Provider value={value}>
      <CacheProvider value={rtlCache}>
        <MuiThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </MuiThemeProvider>
      </CacheProvider>
    </ColorModeContext.Provider>
  )
}
