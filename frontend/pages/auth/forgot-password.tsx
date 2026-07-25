import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import axios from "axios";
import { TextField } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: color.ink, background: color.paper, fontFamily: font.body }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: font.display, fontWeight: 600, fontSize: 19, color: color.ink, display: "inline-block", marginBottom: 28 }}>
            LearnPath
          </Link>

          {sent ? (
            <>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "0 0 8px" }}>Reset your password</h1>
              <div style={{ background: color.success.bg, border: "1px solid #C3E1D3", borderRadius: 8, padding: "14px 16px", fontSize: 13.5, color: color.success.fg, lineHeight: 1.5, marginBottom: 20 }}>
                If an account exists for {email.trim().toLowerCase()}, a reset link is on its way.
              </div>
              <Link href="/auth/login" style={{ textDecoration: "none", padding: "10px 16px", fontSize: 13.5, fontWeight: 600, borderRadius: 7, border: "1px solid #CFCBC0", color: color.ink, display: "inline-block" }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "0 0 8px" }}>Reset your password</h1>
              <p style={{ fontSize: 13.5, color: color.textFaint, margin: "0 0 24px", lineHeight: 1.5 }}>
                Enter the email on your account and we&rsquo;ll send a link to reset your password.
              </p>
              {error && (
                <div style={{ background: color.danger.bg, border: "1px solid #E7B7AE", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#8B4A3E", marginBottom: 16 }}>{error}</div>
              )}
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: 18 }}>
                  <TextField label="Email" type="email" autoComplete="email" placeholder="student@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", padding: "11px 16px", fontSize: 14.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <div style={{ fontSize: 13, color: color.textFaint, textAlign: "center", marginTop: 20 }}>
                Remembered it?{" "}
                <Link href="/auth/login" style={{ textDecoration: "none", fontWeight: 600, color: "#2B3A67" }}>
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
