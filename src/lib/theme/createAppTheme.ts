import { arEG } from '@mui/material/locale'
import { createTheme, type Theme } from '@mui/material/styles'

const arabicFontFamily = [
  '"Noto Sans Arabic"',
  '"Segoe UI"',
  'Tahoma',
  'Arial',
  'sans-serif',
].join(',')

const sharedTypography = {
  fontFamily: arabicFontFamily,
  button: {
    textTransform: 'none' as const,
    fontWeight: 600,
  },
}

const touchTarget = {
  minHeight: 44,
  minWidth: 44,
}

export type ColorMode = 'light' | 'dark'

export function createAppTheme(mode: ColorMode): Theme {
  const isLight = mode === 'light'

  return createTheme(
    {
      direction: 'rtl',
      cssVariables: false,
      palette: {
        mode,
        primary: {
          main: isLight ? '#3F5E5A' : '#8FB3AD',
          contrastText: isLight ? '#FFFFFF' : '#10201D',
        },
        secondary: {
          main: isLight ? '#5B6670' : '#A8B0B8',
        },
        background: {
          default: isLight ? '#F5F6F7' : '#121417',
          paper: isLight ? '#FFFFFF' : '#1A1D22',
        },
        text: {
          primary: isLight ? '#1C1F24' : '#E8EAED',
          secondary: isLight ? '#5C6570' : '#A8B0B8',
        },
        divider: isLight ? '#E2E5E9' : '#2C3138',
        error: {
          main: isLight ? '#B42318' : '#F97066',
        },
        success: {
          main: isLight ? '#2F6B4F' : '#6FCF97',
        },
      },
      typography: sharedTypography,
      shape: {
        borderRadius: 10,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              ...touchTarget,
              paddingInline: 16,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: touchTarget,
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              minHeight: 44,
            },
          },
        },
        MuiBottomNavigationAction: {
          styleOverrides: {
            root: {
              minWidth: 64,
              minHeight: 56,
              paddingTop: 8,
              paddingBottom: 8,
            },
            label: {
              fontSize: '0.75rem',
              '&.Mui-selected': {
                fontSize: '0.75rem',
              },
            },
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              fontFamily: arabicFontFamily,
            },
          },
        },
      },
    },
    arEG,
  )
}
