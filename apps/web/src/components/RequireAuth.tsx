import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * When true, activates the placeholder gate redirecting to /login.
   * Can be tested via query parameter ?auth=required or gate flag.
   */
  enforceGate?: boolean;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, enforceGate = false }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isAuthGateTriggered = enforceGate || searchParams.get('auth') === 'required';

  if (isAuthGateTriggered) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
