import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  logoutAll as logoutAllRequest,
  refresh,
} from '@/api/auth.api'
import { setAccessToken } from '@/api/client'
import type { AuthUser } from '@/types'

export interface LoginResult {
  /** True when the account has MFA enabled and a TOTP code is still required. */
  mfaRequired?: boolean
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string, totp?: string) => Promise<LoginResult>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const { accessToken } = await refresh()
        setAccessToken(accessToken)
        const me = await getMe()
        if (!cancelled) setUser(me)
      } catch {
        setAccessToken(null)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string, totp?: string): Promise<LoginResult> => {
    const res = await loginRequest({ email, password, totp })
    if (res.mfaRequired) {
      return { mfaRequired: true }
    }
    setAccessToken(res.accessToken ?? null)
    const me = await getMe()
    setUser(me)
    return {}
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await getMe()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const logoutAll = useCallback(async () => {
    try {
      await logoutAllRequest()
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const hasAnyPermission = useCallback(
    (permissions: string[]) => permissions.some((permission) => user?.permissions.includes(permission)),
    [user],
  )

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, logoutAll, refreshUser, hasPermission, hasAnyPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}
