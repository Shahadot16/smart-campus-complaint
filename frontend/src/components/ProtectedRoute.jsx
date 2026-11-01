import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { HOME_BY_ROLE, useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'

/** Requires a logged-in user, optionally with one of `roles`. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Checking your session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />
  return <Outlet />
}

export function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  return <Outlet />
}
