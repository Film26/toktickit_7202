import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as loginRequest, type AuthUser } from '../api/auth'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  applySession: (token: string, user: AuthUser) => void
  logout: () => void
  setUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_STORAGE_KEY = 'toktickit.token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function rehydrate() {
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const { user: currentUser } = await fetchMe(token)
        if (!cancelled) setUserState(currentUser)
      } catch {
        if (!cancelled) {
          setToken(null)
          localStorage.removeItem(TOKEN_STORAGE_KEY)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    rehydrate()
    return () => {
      cancelled = true
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password)
    setToken(response.token)
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token)
    setUserState(response.user)
  }, [])

  // Used by the Lab 2 Development Requester Selector: applies a session
  // issued by the no-password dev-select endpoint, without going through
  // the real email/password login flow.
  const applySession = useCallback((sessionToken: string, sessionUser: AuthUser) => {
    setToken(sessionToken)
    localStorage.setItem(TOKEN_STORAGE_KEY, sessionToken)
    setUserState(sessionUser)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUserState(null)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }, [])

  const setUser = useCallback((nextUser: AuthUser) => {
    setUserState(nextUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, applySession, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
