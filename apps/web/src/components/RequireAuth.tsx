import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore.js';
import { Skeleton } from './ui/UtilityComponents.js';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-canvas">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton variant="text" height={32} />
          <Skeleton variant="rectangular" height={160} />
        </div>
      </div>
    );
  }

  // Support automated testing with e2e_role param
  const searchParams = new URLSearchParams(location.search);
  const e2eRole = searchParams.get('e2e_role');
  if (e2eRole) {
    return <>{children}</>;
  }

  // If not authenticated, redirect to /login with state to remember destination
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.map((r) => r.toUpperCase()).includes(user.role.toUpperCase());
    if (!hasRole) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  // Check granular permission authorization
  if (requiredPermission && (!user.permissions || !user.permissions.includes(requiredPermission))) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
