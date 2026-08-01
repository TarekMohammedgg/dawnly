import { AppRouterProvider } from './components/AppRouterProvider'
import { AppShell } from './components/AppShell'
import { AppThemeProvider } from './components/AppThemeProvider'
import { AuthSessionProvider } from './components/AuthSessionProvider'
import { PinGate } from './features/auth/PinGate'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { LoadingState } from './components/LoadingState'
import { lazy, Suspense } from 'react'
import { useAppRouter } from './lib/routing/routerContext'

const ImportPage = lazy(async () => {
  const module = await import('./features/import/ImportPage.tsx')
  return { default: module.ImportPage }
})

const LedgerPage = lazy(async () => {
  const module = await import('./features/ledger/LedgerPage.tsx')
  return { default: module.LedgerPage }
})

const PersonPage = lazy(async () => {
  const module = await import('./features/person/PersonPage.tsx')
  return { default: module.PersonPage }
})

const PeoplePage = lazy(async () => {
  const module = await import('./features/person/PeoplePage.tsx')
  return { default: module.PeoplePage }
})

const SettingsPage = lazy(async () => {
  const module = await import('./features/settings/SettingsPage.tsx')
  return { default: module.SettingsPage }
})

function AppRoutes() {
  const { routeId } = useAppRouter()

  return (
    <Suspense fallback={<LoadingState label="جاري تحميل الصفحة…" />}>
      {routeId === 'ledger' ? <LedgerPage /> : null}
      {routeId === 'import' ? <ImportPage /> : null}
      {routeId === 'people' ? <PeoplePage /> : null}
      {routeId === 'settings' ? <SettingsPage /> : null}
      {routeId === 'person' ? <PersonPage /> : null}
      {routeId === 'dashboard' ? <DashboardPage /> : null}
    </Suspense>
  )
}

export default function App() {
  return (
    <AppThemeProvider>
      <AuthSessionProvider>
        <PinGate>
          <AppRouterProvider>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </AppRouterProvider>
        </PinGate>
      </AuthSessionProvider>
    </AppThemeProvider>
  )
}
