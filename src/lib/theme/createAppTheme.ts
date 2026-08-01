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
    fontWeight: 700,
  },
  body1: { lineHeight: 1.7 },
  body2: { lineHeight: 1.65 },
  h4: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.35 },
  h5: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.35 },
  h6: { fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.4 },
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
          light: isLight ? '#E2F0EC' : '#2B4D46',
          main: isLight ? '#1D5B52' : '#8CC5B6',
          dark: isLight ? '#123F39' : '#BDE0D5',
          contrastText: isLight ? '#FFFFFF' : '#10201D',
        },
        secondary: {
          light: isLight ? '#F8E3D9' : '#5A3023',
          main: isLight ? '#B85B3D' : '#F2A080',
          dark: isLight ? '#8F3F2A' : '#FFC2AA',
          contrastText: isLight ? '#FFFFFF' : '#2B1710',
        },
        background: {
          default: isLight ? '#F7F5F1' : '#111917',
          paper: isLight ? '#FFFCF8' : '#17211F',
        },
        text: {
          primary: isLight ? '#1D2522' : '#F1F3EF',
          secondary: isLight ? '#68726F' : '#AFBCB7',
        },
        divider: isLight ? '#E5E3DE' : '#2F3B36',
        error: {
          main: isLight ? '#B9443E' : '#FF8C84',
          dark: isLight ? '#87302C' : '#FFB1AA',
        },
        success: {
          light: isLight ? '#E2F1EA' : '#203D32',
          main: isLight ? '#2F7A61' : '#82CFAF',
          dark: isLight ? '#1E523F' : '#B0E7CE',
          contrastText: isLight ? '#FFFFFF' : '#10201D',
        },
        warning: {
          light: isLight ? '#F8E9DD' : '#4D3022',
          main: isLight ? '#B96B3D' : '#E8A477',
          dark: isLight ? '#7B4224' : '#FFD0B4',
          contrastText: isLight ? '#FFFFFF' : '#2B1710',
        },
        info: {
          light: isLight ? '#E5F0F2' : '#20373A',
          main: isLight ? '#4A7C85' : '#8EC5CD',
          dark: isLight ? '#315861' : '#C1E4E8',
        },
      },
      typography: sharedTypography,
      shape: {
        borderRadius: 16,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              ...touchTarget,
              paddingInline: 16,
              borderRadius: 14,
              fontWeight: 700,
              '&.MuiButton-contained': {
                boxShadow: '0 8px 18px rgba(29, 91, 82, 0.16)',
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 20,
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 14,
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
              color: isLight ? '#68726F' : '#AFBCB7',
              '&.Mui-selected': {
                color: isLight ? '#1D5B52' : '#8CC5B6',
              },
            },
            label: {
              fontSize: '0.75rem',
              fontWeight: 600,
              '&.Mui-selected': {
                fontSize: '0.75rem',
                fontWeight: 800,
              },
            },
          },
        },
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              fontFamily: arabicFontFamily,
              backgroundColor: isLight ? '#F7F5F1' : '#111917',
            },
          },
        },
      },
    },
    arEG,
  )
}
