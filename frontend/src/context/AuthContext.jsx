import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Create the Context
const AuthContext = createContext(undefined);

// Create the Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [userType, setUserType] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);

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
  const loginStaff = async (email, password) => {
    setError(null);
    setAuthLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      if (response.data.success) {
        setUser(response.data.user);
        setUserType('staff');
        setPermissions(response.data.permissions || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Staff login failed. Please try again.');
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  // Customer Login Handler
  const loginCustomer = async (identifier, password) => {
    setError(null);
    setAuthLoading(true);
    try {
      const response = await api.post('/api/portal/login', { identifier, password });
      if (response.data.success) {
        setCustomer(response.data.customer);
        setUserType('customer');
        setPermissions([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Customer login failed. Please try again.');
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout Handler (works for both Staff & Customers)
  const logout = async () => {
    setAuthLoading(true);
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      setCustomer(null);
      setUserType(null);
      setPermissions([]);
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const hasPermission = (permissionCode) => {
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
        authLoading,
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

// Custom Hook to use AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};