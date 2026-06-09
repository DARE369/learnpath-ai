import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post("/api/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 1800);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "This reset link is invalid or has expired.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Set a new password — LearnPath AI</title>
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5 tracking-tight">Set a new password</h1>
            <p className="text-white/45 text-sm">Choose a strong password you don&apos;t use elsewhere.</p>
          </div>

          <div className="auth-card">
            {done ? (
              <div className="text-center">
                <p className="text-white text-sm">Password updated. Redirecting you to sign in…</p>
                <Link href="/auth/login" className="mt-6 inline-block text-accent-light hover:text-white text-sm font-medium">
                  Sign in now
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-error-muted border border-error/20 text-error text-sm">
                    {error}
                  </div>
                )}
                <div className="mb-4">
                  <label htmlFor="password" className="label">New password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    disabled={loading}
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="confirm" className="label">Confirm password</label>
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input-field"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
