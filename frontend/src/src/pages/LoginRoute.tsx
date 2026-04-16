import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const LoginRoute: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  if (user) return <Navigate to="/app" replace />;

  return <Navigate to="/?login=1" state={location.state} replace />;
};

export default LoginRoute;

