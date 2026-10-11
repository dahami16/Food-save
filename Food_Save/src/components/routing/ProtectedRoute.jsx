import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Frontend route guard for Hotel Admin routes (Stage 3A).
 *
 * Waits for session restoration (`loading`) before deciding, then
 * grants access ONLY when the trusted profile loaded from
 * GET /api/auth/me has role === "admin".
 *
 *   restoration pending          -> render nothing (no premature redirect)
 *   unauthenticated              -> /signin
 *   authenticated non-admin      -> /restaurants (customer landing)
 *
 * This is a navigation safeguard only — it does not replace
 * server-side authorization for future admin APIs.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }
  if (!user) {
    return <Navigate to="/signin" replace />
  }
  if (user.role !== 'admin') {
    return <Navigate to="/restaurants" replace />
  }
  return children
}

export default ProtectedRoute