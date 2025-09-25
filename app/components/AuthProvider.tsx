'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (emailOrUsername: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, firstName: string, lastName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  getAuthToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      if (token) {
        try {
          // Verify token with backend
          const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setIsAuthenticated(false);
            setUser(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated and not already on login or register page
    if (!isLoading && !isAuthenticated && pathname !== '/login' && pathname !== '/register') {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const login = async (emailOrUsername: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrUsername, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        // Set user data
        setUser(data.user);
        setIsAuthenticated(true);
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const register = async (username: string, email: string, firstName: string, lastName: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, firstName, lastName, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        // Set user data
        setUser(data.user);
        setIsAuthenticated(true);
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Call logout endpoint
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setIsAuthenticated(false);
      setUser(null);
      router.push('/login');
    }
  };

  const getAuthToken = (): string | null => {
    return localStorage.getItem('accessToken');
  };

  const value = {
    isAuthenticated,
    user,
    login,
    register,
    logout,
    isLoading,
    getAuthToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}