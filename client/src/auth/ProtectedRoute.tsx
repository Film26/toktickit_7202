import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../api/auth'
import LoadingSpinner from '../components/LoadingSpinner'

type ProtectedRouteProps = {
  children: ReactNode
  roles?: Role[]
}

function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.mustChangePassword && location.pathname !== '/first-password-change') {
    return <Navigate to="/first-password-change" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/access-denied" replace />
  }

  return children
}

export default ProtectedRoute
