import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import { TextField } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: color.ink, background: color.paper, fontFamily: font.body }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <Link href="/" style={{ textDecoration: "none", fontFamily: font.display, fontWeight: 600, fontSize: 19, color: color.ink, display: "inline-block", marginBottom: 28 }}>
            LearnPath
          </Link>

          {done ? (
            <>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "0 0 8px" }}>Set a new password</h1>
              <div style={{ background: color.success.bg, border: "1px solid #C3E1D3", borderRadius: 8, padding: "14px 16px", fontSize: 13.5, color: color.success.fg }}>
                Password updated. Redirecting you to sign in…
              </div>
              <Link href="/auth/login" style={{ textDecoration: "none", fontWeight: 600, color: "#2B3A67", display: "inline-block", marginTop: 16 }}>
                Sign in now
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: "0 0 8px" }}>Set a new password</h1>
              <p style={{ fontSize: 13.5, color: color.textFaint, margin: "0 0 24px" }}>Choose a strong password you don&rsquo;t use elsewhere.</p>
              {error && (
                <div style={{ background: color.danger.bg, border: "1px solid #E7B7AE", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#8B4A3E", marginBottom: 16 }}>{error}</div>
              )}
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: 14 }}>
                  <TextField label="New password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <TextField label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", padding: "11px 16px", fontSize: 14.5, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
