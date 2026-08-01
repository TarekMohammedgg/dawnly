import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { BrandMark } from './BrandMark'
import { SyncStatusIndicator } from '../features/sync/SyncStatusIndicator'
import { useAppRouter } from '../lib/routing/routerContext'
import { NAV_ITEMS } from '../lib/routing/routes'

const ROUTE_ICONS: Record<(typeof NAV_ITEMS)[number]['id'], ReactNode> = {
  dashboard: <HomeOutlinedIcon />,
  ledger: <AccountBalanceWalletOutlinedIcon />,
  import: <FileUploadOutlinedIcon />,
  settings: <SettingsOutlinedIcon />,
}

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { routeId, navigate } = useAppRouter()
  const navValue = routeId === 'person' ? 'ledger' : routeId

  return (
    <Box
      sx={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar
          sx={{
            width: '100%',
            maxWidth: 600,
            minHeight: { xs: 72, sm: 80 },
            mx: 'auto',
            py: 1.25,
          }}
        >
          <BrandMark />
          <Box sx={{ mr: 1.25, minWidth: 0 }}>
            <Typography variant="h6" component="h1" sx={{ lineHeight: 1.1 }}>
              Dawnly
            </Typography>
            <Typography variant="caption" color="text.secondary">
              دفتر ليّا وعليّا
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        maxWidth="sm"
        sx={{
          flex: 1,
          pt: { xs: 2.5, sm: 3 },
          pb: 12,
          width: '100%',
        }}
      >
        <SyncStatusIndicator />
        {children}
      </Container>

      <Paper
        component="nav"
        aria-label="التنقل الرئيسي"
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderRadius: 0,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <BottomNavigation
          showLabels
          value={navValue}
          onChange={(_event, value: (typeof NAV_ITEMS)[number]['id']) => {
            const item = NAV_ITEMS.find((nav) => nav.id === value)
            if (item) {
              navigate(item.path)
            }
          }}
          sx={{ height: { xs: 70, sm: 74 }, maxWidth: 600, mx: 'auto' }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.id}
              label={item.label}
              value={item.id}
              icon={ROUTE_ICONS[item.id]}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
