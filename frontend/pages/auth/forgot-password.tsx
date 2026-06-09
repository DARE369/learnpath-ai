import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import axios from "axios";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch {
      // The endpoint returns a generic success; only network errors land here.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset password — LearnPath AI</title>
      </Head>
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5 tracking-tight">Reset your password</h1>
            <p className="text-white/45 text-sm">
              Enter your email and we&apos;ll send you a link to set a new password.
            </p>
          </div>

          <div className="auth-card">
            {sent ? (
              <div className="text-center">
                <p className="text-white text-sm">
                  If an account exists for <span className="font-medium">{email.trim().toLowerCase()}</span>,
                  a reset link is on its way. Check your inbox (and spam).
                </p>
                <Link href="/auth/login" className="mt-6 inline-block text-accent-light hover:text-white text-sm font-medium">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-error-muted border border-error/20 text-error text-sm">
                    {error}
                  </div>
                )}
                <div className="mb-6">
                  <label htmlFor="email" className="label">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <p className="text-center text-sm text-white/40 mt-6">
                  Remembered it?{" "}
                  <Link href="/auth/login" className="text-accent-light hover:text-white font-medium">
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
