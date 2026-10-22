import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API } from "../config/api";

const AuthContext = createContext(null);
const TOKEN_KEY = "puc_admin_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true); // true while we verify a stored token

  // On mount, if a token is in storage, verify it's still valid and pull
  // the admin's profile — this is what makes a page refresh not boot you
  // to the login screen unnecessarily.
  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(API.me, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Session invalid");
        const data = await res.json();
        if (!cancelled) setAdmin(data.admin);
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setAdmin(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    rehydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username, password) => {
    let res;
    try {
      res = await fetch(API.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Can't reach the server. Check your connection, or that the API is running.");
    }
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Login failed.");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  // Convenience helper for authenticated fetches elsewhere in the app
  // Authenticated fetch. A 401 means the session expired or was revoked,
  // so sign out here once instead of in every caller.
  const authFetch = useCallback(
    async (url, options = {}) => {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setAdmin(null);
      }
      return res;
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{ token, admin, loading, login, logout, authFetch, isAuthenticated: !!token && !!admin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}