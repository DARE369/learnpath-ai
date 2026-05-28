import React, { useState, useMemo } from "react";
import Link from "next/link";
import axios from "axios";

interface FormState {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  fullName?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface SignupFormProps {
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

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  bg: string;
}

function getPasswordStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: "", color: "", bg: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "text-error", bg: "bg-error" };
  if (score <= 4) return { score, label: "Fair", color: "text-warning", bg: "bg-warning" };
  if (score === 5) return { score, label: "Good", color: "text-accent-light", bg: "bg-accent" };
  return { score, label: "Strong", color: "text-success", bg: "bg-success" };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;

  const bars = 4;
  const filled = Math.ceil((strength.score / 6) * bars);

  return (
    <div className="mt-2.5">
      <div className="flex gap-1 mb-1.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < filled ? strength.bg : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${strength.color}`}>{strength.label}</p>
    </div>
  );
}

interface CheckItemProps {
  met: boolean;
  label: string;
}

function CheckItem({ met, label }: CheckItemProps) {
  return (
    <span className={`flex items-center gap-1 text-xs transition-colors ${met ? "text-success" : "text-white/30"}`}>
      {met ? (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      )}
      {label}
    </span>
  );
}

export default function SignupForm({ onSuccess }: SignupFormProps) {
  const [form, setForm] = useState<FormState>({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwChecks = useMemo(() => ({
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    number: /\d/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(form.password),
  }), [form.password]);

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!form.password) {
      next.password = "Password is required";
    } else if (!Object.values(pwChecks).every(Boolean)) {
      next.password = "Password does not meet requirements";
    }
    if (!form.confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (form.password !== form.confirmPassword) {
      next.confirmPassword = "Passwords do not match";
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
      const res = await axios.post("/api/auth/signup", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.fullName.trim() || undefined,
      });
      const { access_token } = res.data;
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", access_token);
      }
      onSuccess?.(access_token);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 400) {
          if (typeof detail === "string" && detail.includes("Email already")) {
            setErrors({ email: "An account with this email already exists" });
          } else {
            setErrors({ password: detail || "Password does not meet requirements" });
          }
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

      {/* Full name */}
      <div className="mb-4">
        <label htmlFor="fullName" className="label">
          Full name <span className="text-white/30 font-normal">(optional)</span>
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="Alex Johnson"
          value={form.fullName}
          onChange={handleChange("fullName")}
          className="input-field"
          disabled={loading}
        />
      </div>

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
      <div className="mb-4">
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

        {/* Strength meter */}
        <PasswordStrengthMeter password={form.password} />

        {/* Requirements */}
        {form.password && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 bg-surface-elevated rounded-xl border border-border">
            <CheckItem met={pwChecks.length} label="8+ characters" />
            <CheckItem met={pwChecks.upper} label="Uppercase letter" />
            <CheckItem met={pwChecks.lower} label="Lowercase letter" />
            <CheckItem met={pwChecks.number} label="Number" />
            <CheckItem met={pwChecks.special} label="Special character" />
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="mb-6">
        <label htmlFor="confirmPassword" className="label">Confirm password</label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={handleChange("confirmPassword")}
            className={`input-field pr-11 ${errors.confirmPassword ? "error" : ""}`}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors focus:outline-none"
            tabIndex={-1}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            <EyeIcon visible={showConfirm} />
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="error-text">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errors.confirmPassword}
          </p>
        )}
        {form.confirmPassword && form.password === form.confirmPassword && !errors.confirmPassword && (
          <p className="text-success text-xs mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Passwords match
          </p>
        )}
      </div>

      {/* Submit */}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Creating account…
          </span>
        ) : (
          "Create account"
        )}
      </button>

      <p className="text-center text-xs text-white/25 mt-4">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>

      {/* Login link */}
      <p className="text-center text-sm text-white/40 mt-4">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-accent-light hover:text-white font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
