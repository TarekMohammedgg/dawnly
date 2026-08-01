import { createContext, useContext } from 'react'
import type { ColorMode } from './createAppTheme'

export type ColorModeContextValue = {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
}

export const ColorModeContext = createContext<ColorModeContextValue | null>(
  null,
)

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext)
  if (!context) {
    throw new Error('useColorMode must be used within AppThemeProvider')
  }
  return context
}
