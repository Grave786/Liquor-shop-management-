import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export const AuthGuard: React.FC<{ children: React.ReactNode; requiredRole?: 'admin' | 'super_admin' | 'manager' }> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, profile, loading, isAdmin, isSuperAdmin, isManager } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === 'super_admin' && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'manager' && !isManager) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
