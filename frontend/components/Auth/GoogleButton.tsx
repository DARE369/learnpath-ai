import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useAuth } from "../../hooks/useAuth";

interface GoogleButtonProps {
  onSuccess: (accessToken: string) => void;
  rememberMe?: boolean;
  label?: string;
  /** Override the button's own classes — callers outside the legacy dark
   * theme (e.g. ui-v2 pages) pass their own instead of the default. */
  buttonClassName?: string;
}

const DEFAULT_BUTTON_CLASSNAME =
  "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/8 bg-surface-elevated hover:bg-surface-hover transition-colors text-sm font-medium text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed w-full";

export default function GoogleButton({ onSuccess, rememberMe = false, label = "Google", buttonClassName }: GoogleButtonProps) {
  const { loginWithGoogleToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const login = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onError: () => {
      setLoading(false);
      setError("Google sign-in was cancelled or failed");
    },
    onSuccess: async (tokenResponse) => {
      try {
        await loginWithGoogleToken(tokenResponse.access_token, rememberMe);
        onSuccess("");
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || "Google sign-in failed. Please try again.");
        } else {
          setError("Google sign-in failed. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  function handleClick() {
    if (!enabled) {
      setError("Google sign-in is not configured");
      return;
    }
    setError(null);
    setLoading(true);
    login();
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !enabled}
        className={buttonClassName ?? DEFAULT_BUTTON_CLASSNAME}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {loading ? "Signing in…" : label}
      </button>
      {error && (
        <p className="text-xs text-error text-center">{error}</p>
      )}
    </div>
  );
}
