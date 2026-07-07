import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// 1. Define types for our data (TypeScript validation)
export interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
}

export interface Customer {
  id: number;
  name: string;
}

interface AuthContextType {
  user: User | null;
  customer: Customer | null;
  userType: 'staff' | 'customer' | null;
  permissions: string[];
  loading: boolean;
  loginStaff: (email: string, password: string) => Promise<void>;
  loginCustomer: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  setError: (error: string | null) => void;
  hasPermission: (permissionCode: string) => boolean;
}

// 2. Create the Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [userType, setUserType] = useState<'staff' | 'customer' | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if session cookie is active on page load
  const checkSession = async () => {
    try {
      const response = await api.get('/api/auth/me');
      if (response.data.loggedIn) {
        if (response.data.userType === 'staff') {
          setUser(response.data.user);
          setUserType('staff');
          setPermissions(response.data.permissions || []);
        } else if (response.data.userType === 'customer') {
          setCustomer(response.data.customer);
          setUserType('customer');
          setPermissions([]);
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Staff Login Handler
  const loginStaff = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setUserType('staff');
        setPermissions(response.data.permissions || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Staff login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Customer Login Handler
  const loginCustomer = async (identifier: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await api.post('/api/portal/login', { identifier, password });
      if (response.data.success) {
        setCustomer(response.data.customer);
        setUserType('customer');
        setPermissions([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Customer login failed. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Logout Handler (works for both Staff & Customers)
  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      setCustomer(null);
      setUserType(null);
      setPermissions([]);
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (user?.role === 'Admin') return true;
    return permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        userType,
        permissions,
        loading,
        loginStaff,
        loginCustomer,
        logout,
        error,
        setError,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 4. Custom Hook to use AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};