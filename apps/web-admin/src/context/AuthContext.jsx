import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "qz_admin_token";
const ADMIN_KEY = "admin";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    async function verify() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
          localStorage.setItem(ADMIN_KEY, JSON.stringify(data));
        } else {
          // Token invalid or expired
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ADMIN_KEY);
          setToken(null);
        }
      } catch {
        // Network error — keep token, will fail gracefully on next request
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const updateUser = useCallback((newUser) => {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      updateUser,
    }),
    [user, token, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");

  return ctx;
}
