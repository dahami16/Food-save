/**
 * AuthContext — the single source of frontend authentication state.
 *
 * Owns:
 *   - the Supabase access token (sessionStorage ONLY; refresh tokens
 *     and passwords are never stored in this stage)
 *   - the trusted user profile loaded from GET /api/auth/me
 *   - the authentication loading state during session restoration
 *   - login / signup / logout actions shared by all pages
 *
 * The token is stored ONLY after the backend actually returns a valid
 * session, and the profile from /me is the sole source of the user's
 * role (never forms, query params, storage objects or signup data).
 *
 * This provider sits inside AppProvider and keeps AppContext's legacy
 * `role` / `isSignedIn` mirror in sync with the trusted profile, so
 * all existing consumers keep working without duplicated logic.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  AuthApiError,
  getCurrentUser,
  login as requestLogin,
  signup as requestSignup,
} from '../services/authApi'
import { useApp } from './AppContext'

const TOKEN_STORAGE_KEY = 'foodsave.accessToken'

const AuthContext = createContext(null)

function readStoredToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeToken(token) {
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    /* storage unavailable — state alone still works this session */
  }
}

function clearStoredToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const { signIn: mirrorRole, signOut: resetLegacySession } = useApp()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // session restoration

  // ---- Session restoration (startup) ----------------------------------
  useEffect(() => {
    let cancelled = false
    const token = readStoredToken()

    if (!token) {
      setLoading(false)
      return undefined
    }

    getCurrentUser(token)
      .then((profile) => {
        if (!cancelled) setUser(profile)
      })
      .catch((error) => {
        if (cancelled) return
        setUser(null) // never invent a logged-in user
        const status =
          error instanceof AuthApiError && error.status !== null
            ? error.status
            : null
        // Explicit rejection (expired/invalid token) -> discard it.
        // Network/5xx outage -> keep the token, stay unauthenticated
        // for now (recoverable on the next successful load).
        if (status !== null && status >= 400 && status < 500) {
          clearStoredToken()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ---- Keep AppContext (role/isSignedIn) in sync with the profile ----
  // Deps intentionally [user] only: the AppContext action identities
  // change every render, and re-running would reset app state.
  useEffect(() => {
    if (user) {
      mirrorRole(user.role)
    } else {
      resetLegacySession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ---- login ----------------------------------------------------------
  const login = useCallback(async (email, password) => {
    const data = await requestLogin(email, password)
    const token = data?.session?.access_token
    if (!token) {
      throw new AuthApiError('Sign-in did not return a session. Please try again.')
    }
    storeToken(token)
    try {
      const profile = await getCurrentUser(token)
      setUser(profile)
      return profile
    } catch (error) {
      // Profile validation failed -> the new token must not survive.
      clearStoredToken()
      setUser(null)
      throw error
    }
  }, [])

  // ---- signup ---------------------------------------------------------
  const signup = useCallback(async (fullName, email, password) => {
    const data = await requestSignup(fullName, email, password)
    const token = data?.session?.access_token
    if (!token) {
      // No session: email confirmation may be required. The user is
      // NOT authenticated — success must be shown, not assumed.
      return { requiresConfirmation: true, user: data?.user ?? null }
    }
    storeToken(token)
    try {
      const profile = await getCurrentUser(token)
      setUser(profile)
      return { requiresConfirmation: false, user: profile }
    } catch {
      clearStoredToken()
      setUser(null)
      throw new AuthApiError(
        'Your account was created, but signing in failed. Please sign in instead.'
      )
    }
  }, [])

  // ---- logout ---------------------------------------------------------
  // Clears the stored token and the in-memory user only. This stage
  // has no backend sign-out endpoint, so no server-side revocation
  // is claimed; AppContext state resets via the sync effect above.
  const logout = useCallback(() => {
    clearStoredToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Hook for consuming the shared authentication state. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return context
}