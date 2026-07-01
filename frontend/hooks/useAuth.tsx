import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  tier?: string;
  role?: string;
  onboardingCompleted?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  signup: (email: string, password: string, fullName?: string, role?: string) => Promise<void>;
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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Give a 30-second buffer so we don't use a token that'll expire mid-request
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
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
    role: (raw.role as string | undefined) ?? "user",
    onboardingCompleted: (raw.onboarding_completed as boolean | undefined) ?? false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // refs so the global axios interceptor always reads the latest values
  // without being torn down and re-installed on every render
  const tokenRef = useRef<string | null>(null);
  const refreshingRef = useRef<Promise<string | null> | null>(null);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

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

  // Bootstrap: declared AFTER the interceptor effect below so the interceptor
  // is installed before /me fires. Inside the effect we still try a manual
  // refresh on failure as a belt-and-braces second path.
  useEffect(() => {
    const stored = readStoredToken();
    (async () => {
      let u: AuthUser | null = null;

      // 1) If we have a stored access token and it isn't obviously expired, try it.
      //    Skipping an expired token here avoids a guaranteed 401 console error
      //    before falling through to the refresh flow anyway.
      if (stored && !isTokenExpired(stored)) {
        setAccessToken(stored);
        u = await fetchMe(stored);
      }

      // 2) No stored token, token was expired, or /me rejected it:
      //    fall back to the httpOnly refresh cookie.
      if (!u) {
        try {
          const refreshRes = await axios.post("/api/auth/refresh");
          const newToken: string | undefined = refreshRes.data?.access_token;
          if (newToken) {
            // Preserve where the prior token lived: if it was session-only keep
            // it so, otherwise persist (the common cold-load case → localStorage)
            // so the recovered session survives future restarts.
            const remember =
              typeof window === "undefined" || !sessionStorage.getItem(TOKEN_KEY);
            persistToken(newToken, remember);
            setAccessToken(newToken);
            u = await fetchMe(newToken);
          }
        } catch {
          // No valid refresh cookie. If we had a stored token it means the
          // session genuinely expired (vs. a first visit with no session).
          if (stored) setSessionExpired(true);
        }
      }

      if (u) {
        setUser(u);
      } else {
        clearStoredToken();
        setAccessToken(null);
      }
      setLoading(false);
    })();
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
    async (email: string, password: string, remember = true) => {
      setSessionExpired(false);
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
    async (email: string, password: string, fullName?: string, role?: string) => {
      setSessionExpired(false);
      const res = await axios.post("/api/auth/signup", {
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName?.trim() || undefined,
        role: role || undefined,
      });
      const token: string = res.data.access_token;
      // New users stay signed in across restarts (persist to localStorage).
      persistToken(token, true);
      setAccessToken(token);
      setUser(mapUser(res.data.user));
    },
    [],
  );

  const loginWithGoogleToken = useCallback(
    async (googleAccessToken: string, remember = false) => {
      setSessionExpired(false);
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

  // Global axios interceptor: on 401, hit /api/auth/refresh (uses httpOnly
  // refresh-token cookie), retry the original request with the new token.
  // Installed once on mount; reads token from ref so it always sees the latest.
  useEffect(() => {
    const isAuthEndpoint = (url?: string) =>
      !!url && (url.includes("/api/auth/refresh") || url.includes("/api/auth/login") ||
                url.includes("/api/auth/signup") || url.includes("/api/auth/google"));

    const tryRefresh = async (): Promise<string | null> => {
      if (refreshingRef.current) return refreshingRef.current;
      refreshingRef.current = (async () => {
        try {
          const res = await axios.post("/api/auth/refresh");
          const newToken = res.data?.access_token as string | undefined;
          if (!newToken) return null;
          const remember = typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY);
          persistToken(newToken, remember);
          setAccessToken(newToken);
          return newToken;
        } catch {
          return null;
        } finally {
          refreshingRef.current = null;
        }
      })();
      return refreshingRef.current;
    };

    const interceptor = axios.interceptors.response.use(
      (resp) => resp,
      async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
        const status = error.response?.status;
        if (status !== 401 || !original || original._retried || isAuthEndpoint(original.url)) {
          return Promise.reject(error);
        }
        original._retried = true;
        const newToken = await tryRefresh();
        if (!newToken) {
          // Refresh failed — session has truly expired.
          clearStoredToken();
          setAccessToken(null);
          setUser(null);
          setSessionExpired(true);
          return Promise.reject(error);
        }
        original.headers = original.headers || {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return axios(original);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoggedIn: Boolean(user && accessToken),
    loading,
    sessionExpired,
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
