// client/src/context/AuthContext.jsx
// Centralized authentication state management for SkillSwap SPA

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'

  // Fetch current session from server
  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/session');
      if (data?.user) {
        setUser(data.user);
        setStatus('authenticated');
        return data.user;
      } else {
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }
    } catch {
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  // Handle user login
  const login = useCallback(async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data?.user) {
      setUser(data.user);
      setStatus('authenticated');
      return data.user;
    }
    // Fallback: re-fetch session if user not returned in body
    return await refresh();
  }, [refresh]);

  // Handle user registration (server auto-logs in and sets cookie)
  const register = useCallback(async (name, email, password) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (data?.user) {
      setUser(data.user);
      setStatus('authenticated');
      return data.user;
    }
    return await refresh();
  }, [refresh]);

  // Handle user logout
  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network failure on logout; clear local state anyway
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
