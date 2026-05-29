import React, { useState } from "react";
import Link from "next/link";
import axios from "axios";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";

const GoogleButton = dynamic(() => import("./GoogleButton"), {
  ssr: false,
  loading: () => (
    <div className="h-[42px] w-full rounded-xl border border-white/8 bg-surface-elevated animate-pulse" />
  ),
});

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface LoginFormProps {
  onSuccess?: (accessToken: string) => void;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!form.password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await login(form.email, form.password, rememberMe);
      onSuccess?.("");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 401) {
          setErrors({ general: "Incorrect email or password" });
        } else if (err.response?.status === 403) {
          setErrors({ general: detail || "Account deactivated. Contact support." });
        } else {
          setErrors({ general: detail || "Something went wrong. Please try again." });
        }
      } else {
        setErrors({ general: "Network error. Check your connection." });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
      if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
    };
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="animate-slide-up">
      {/* General error */}
      {errors.general && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-error-muted border border-error/20 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-error text-sm">{errors.general}</span>
        </div>
      )}

      {/* Email */}
      <div className="mb-4">
        <label htmlFor="email" className="label">Email address</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange("email")}
          className={`input-field ${errors.email ? "error" : ""}`}
          disabled={loading}
        />
        {errors.email && (
          <p className="error-text">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="password" className="label mb-0">Password</label>
          <Link href="/auth/forgot-password" className="text-xs text-accent-light hover:text-accent transition-colors">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange("password")}
            className={`input-field pr-11 ${errors.password ? "error" : ""}`}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors focus:outline-none"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>
        {errors.password && (
          <p className="error-text">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember me */}
      <div className="flex items-center gap-2 mb-6">
        <input
          id="remember"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 rounded border-white/20 bg-surface-elevated text-accent focus:ring-accent/50 cursor-pointer"
        />
        <label htmlFor="remember" className="text-sm text-white/50 cursor-pointer select-none">
          Keep me signed in
        </label>
      </div>

      {/* Submit */}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/8" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-surface text-white/30 text-xs">or continue with</span>
        </div>
      </div>

      {/* Social login */}
      <GoogleButton
        onSuccess={(token) => onSuccess?.(token)}
        rememberMe={rememberMe}
        label="Continue with Google"
      />

      {/* Sign up link */}
      <p className="text-center text-sm text-white/40 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-accent-light hover:text-white font-medium transition-colors">
          Create one free
        </Link>
      </p>
    </form>
  );
}
