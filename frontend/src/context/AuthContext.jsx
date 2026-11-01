import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, setUnauthorizedHandler } from '../services/api'

const AuthContext = createContext(null)

export const HOME_BY_ROLE = { student: '/student', admin: '/admin', staff: '/staff', dept_head: '/dept' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from the HttpOnly cookie on first load.
  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  // Returns the user, or { twoFactorRequired, challengeToken } when a code is needed.
  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials)
    if (res.data.twoFactorRequired) return res.data
    setUser(res.data.user)
    return res.data.user
  }, [])

  const completeTwoFactor = useCallback(async (challengeToken, code) => {
    const res = await authApi.loginTwoFactor({ challengeToken, code })
    setUser(res.data.user)
    return res.data.user
  }, [])

  const register = useCallback(async (body) => {
    const res = await authApi.register(body)
    setUser(res.data.user)
    return res.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, setUser, loading, login, completeTwoFactor, register, logout }),
    [user, loading, login, completeTwoFactor, register, logout]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
