import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";
import AuthSplitLayout from "../../ui-v2/AuthSplitLayout";
import { TextField, FormError, ThresholdRing } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

const GoogleButton = dynamic(() => import("../../components/Auth/GoogleButton"), {
  ssr: false,
  loading: () => <div style={{ height: 42, width: "100%", borderRadius: 7, border: "1px solid #CFCBC0" }} />,
});

const GOOGLE_BUTTON_CLASSNAME =
  "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#CFCBC0] bg-white hover:bg-[#F7F5F0] transition-colors text-sm font-semibold text-[#14171F] disabled:opacity-50 disabled:cursor-not-allowed w-full";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goNext() {
    const next = typeof router.query.next === "string" ? router.query.next : "/dashboard";
    router.push(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password, keepSignedIn);
      goNext();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 401) setError("Incorrect email or password");
        else if (err.response?.status === 403) setError(detail || "Account deactivated. Contact support.");
        else setError(detail || "Something went wrong. Please try again.");
      } else {
        setError("Network error. Check your connection.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in — LearnPath AI</title>
      </Head>

      <AuthSplitLayout
        brandPanel={
          <>
            <Link href="/" style={{ textDecoration: "none", fontFamily: font.display, fontWeight: 600, fontSize: 20, color: color.chromeText }}>
              LearnPath
            </Link>
            <div>
              <div style={{ marginBottom: 20 }}>
                <ThresholdRing pct={74} threshold={70} size={92} dark />
              </div>
              <div style={{ fontFamily: font.mono, fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "#C8792A", marginBottom: 10 }}>
                How mastery is scored
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: "#D9D5C9", maxWidth: 340 }}>
                Every score in LearnPath is measured against a pass line, not just a magnitude — 70% and above reads as ready, below reads as a gap to close.
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#5C6478" }}>© LearnPath AI · early access</div>
          </>
        }
      >
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 26, margin: "0 0 8px" }}>Welcome back</h1>
        <p style={{ fontSize: 13.5, color: color.textFaint, margin: "0 0 28px" }}>Sign in to pick up exactly where you left off.</p>

        {error && <FormError>{error}</FormError>}

        <div style={{ marginBottom: 18 }}>
          <GoogleButton onSuccess={goNext} rememberMe={keepSignedIn} label="Continue with Google" buttonClassName={GOOGLE_BUTTON_CLASSNAME} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: color.border }} />
          <div style={{ fontSize: 11.5, color: color.textFainter }}>or with email</div>
          <div style={{ flex: 1, height: 1, background: color.border }} />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="student@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Password</div>
              <Link href="/auth/forgot-password" style={{ textDecoration: "none", fontSize: 12, fontWeight: 500, color: "#2B3A67" }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={pwVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                style={{ width: "100%", padding: "10px 40px 10px 12px", fontSize: 14, fontFamily: font.body, border: "1px solid #CFCBC0", borderRadius: 6, background: "#fff", outline: "none", color: color.ink }}
              />
              <button
                type="button"
                onClick={() => setPwVisible((v) => !v)}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: color.textFaint, fontWeight: 600, padding: "4px 6px" }}
              >
                {pwVisible ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: color.inkSoft, marginBottom: 22, cursor: "pointer" }}>
            <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} style={{ width: 15, height: 15 }} />
            Keep me signed in
          </label>
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "11px 16px",
              fontSize: 14.5,
              fontWeight: 600,
              borderRadius: 7,
              border: "none",
              background: submitting ? "#B7BDD1" : "#2B3A67",
              color: submitting ? "#E4E7F0" : "#fff",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ fontSize: 13, color: color.textFaint, textAlign: "center", marginTop: 22 }}>
          Don&rsquo;t have an account?{" "}
          <Link href="/auth/signup" style={{ textDecoration: "none", fontWeight: 600, color: "#2B3A67" }}>
            Create one
          </Link>
        </div>
      </AuthSplitLayout>
    </>
  );
}
