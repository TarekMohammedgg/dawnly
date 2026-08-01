import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AuthSessionContext,
  type AuthSession,
  type AuthSessionContextValue,
} from '../lib/auth/sessionContext'
import { clearLocalEncryptionKey } from '../lib/local/encryption'

type AuthSessionProviderProps = {
  children: ReactNode
}

function isSessionExpired(session: AuthSession, now = Date.now()): boolean {
  const expiresAt = Date.parse(session.expiresAt)
  return Number.isNaN(expiresAt) || expiresAt <= now
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const activeSession =
    session && !isSessionExpired(session) ? session : null

  useEffect(() => {
    if (!session || isSessionExpired(session)) {
      return
    }

    const expiresAt = Date.parse(session.expiresAt)
    const remaining = expiresAt - Date.now()
    const timer = window.setTimeout(() => {
      clearLocalEncryptionKey()
      setSessionState(null)
    }, remaining)

    return () => window.clearTimeout(timer)
  }, [session])

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      session: activeSession,
      setSession: (next) => {
        setSessionState(next)
      },
      clearSession: () => {
        clearLocalEncryptionKey()
        setSessionState(null)
      },
    }),
    [activeSession],
  )

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  )
}
