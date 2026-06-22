import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { FullPageSpinner } from '@/components/Spinner'
import { ForbiddenPage } from '@/pages/errors/ForbiddenPage'

export interface ProtectedRouteProps {
  children: ReactNode
  permission?: string
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (permission && !hasPermission(permission)) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
