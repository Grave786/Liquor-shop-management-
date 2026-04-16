import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from './types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  login: (token: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json().catch(() => null);
            if (!data) throw new Error('Invalid response from server');
            setUser(data);
            setProfile({
              uid: data.id,
              email: data.email,
              role: data.role,
              displayName: data.displayName,
              outletId: data.outletId
            });
          } else {
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Auth check failed:', err);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (token: string, userData: any) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setProfile({
      uid: userData.id,
      email: userData.email,
      role: userData.role,
      displayName: userData.displayName,
      outletId: userData.outletId
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = isAdmin || profile?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, isManager, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
