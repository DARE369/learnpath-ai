import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import axios from "axios";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  tier?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  loginWithGoogleToken: (googleAccessToken: string, remember?: boolean) => Promise<void>;
  setSessionFromToken: (token: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "access_token";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function persistToken(token: string, remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function mapUser(raw: Record<string, unknown>): AuthUser {
  return {
    id: String(raw.id),
    email: String(raw.email),
    fullName: (raw.full_name as string | null) ?? null,
    tier: raw.tier as string | undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return mapUser(res.data);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const token = readStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAccessToken(token);
    fetchMe(token).then((u) => {
      if (u) {
        setUser(u);
      } else {
        clearStoredToken();
        setAccessToken(null);
      }
      setLoading(false);
    });
  }, [fetchMe]);

  const setSessionFromToken = useCallback(
    async (token: string, remember = false) => {
      persistToken(token, remember);
      setAccessToken(token);
      const u = await fetchMe(token);
      if (!u) {
        clearStoredToken();
        setAccessToken(null);
        throw new Error("Failed to load user profile");
      }
      setUser(u);
    },
    [fetchMe],
  );

  const login = useCallback(
    async (email: string, password: string, remember = false) => {
      const res = await axios.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const token: string = res.data.access_token;
      persistToken(token, remember);
      setAccessToken(token);
      setUser(mapUser(res.data.user));
    },
    [],
  );

  const signup = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const res = await axios.post("/api/auth/signup", {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName?.trim() || undefined,
      });
      const token: string = res.data.access_token;
      persistToken(token, false);
      setAccessToken(token);
      setUser(mapUser(res.data.user));
    },
    [],
  );

  const loginWithGoogleToken = useCallback(
    async (googleAccessToken: string, remember = false) => {
      const res = await axios.post("/api/auth/google", {
        access_token: googleAccessToken,
      });
      const token: string = res.data.access_token;
      persistToken(token, remember);
      setAccessToken(token);
      setUser(mapUser(res.data.user));
    },
    [],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setAccessToken(null);
    axios.post("/api/auth/logout").catch(() => { /* non-blocking */ });
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const u = await fetchMe(accessToken);
    if (u) setUser(u);
  }, [accessToken, fetchMe]);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoggedIn: Boolean(user && accessToken),
    loading,
    login,
    signup,
    loginWithGoogleToken,
    setSessionFromToken,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
