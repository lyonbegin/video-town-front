import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useClinicalAuth } from './ClinicalAuthContext';
import { hasAnyRole } from './clinicalSession';

export function ClinicalRoleGate({
  requiredRoles,
  children,
}: {
  requiredRoles: string[];
  children: React.ReactNode;
}) {
  const { session } = useClinicalAuth();
  const location = useLocation();

  if (!requiredRoles.length) return <>{children}</>;

  if (!session.userId || !hasAnyRole(session, requiredRoles)) {
    return (
      <Navigate
        to="/clinical/common/g01"
        replace
        state={{ returnTo: location.pathname, clinicalAccessRequired: true }}
      />
    );
  }

  return <>{children}</>;
}
