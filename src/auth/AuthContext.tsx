import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MOCK_USERS, type UserRole } from './mockUsers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTH_STORAGE_KEY = 'reefer_app_auth_user';

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：從 localStorage 恢復 session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        // 驗證 ID 仍在 mock 清單中（未來換 Supabase 後，改成 token 驗證）
        const valid = MOCK_USERS.some((u) => u.id === parsed.id);
        if (valid) setUser(parsed);
      }
    } catch {
      // 損壞的 storage 就清掉
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      // 模擬網路延遲 (換 Supabase 時直接替換這段)
      await new Promise((r) => setTimeout(r, 600));

      const found = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (!found) {
        return { success: false, error: '帳號或密碼不正確' };
      }

      const authUser: AuthUser = {
        id: found.id,
        email: found.email,
        role: found.role,
        displayName: found.displayName,
      };

      setUser(authUser);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      } catch {
        // storage 不可用時不中斷流程
      }

      return { success: true };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
