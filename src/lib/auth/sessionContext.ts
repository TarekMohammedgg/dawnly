import { createContext, useContext } from 'react'

export type AuthSession = {
  token: string
  expiresAt: string
}

export type AuthSessionContextValue = {
  session: AuthSession | null
  setSession: (session: AuthSession) => void
  clearSession: () => void
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(
  null,
)

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext)
  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider')
  }
  return context
}
