import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import dynamic from "next/dynamic";
import { useAuth } from "../../hooks/useAuth";
import { homeForRole } from "../../components/layout/nav";
import AuthSplitLayout from "../../ui-v2/AuthSplitLayout";
import { TextField, FormError } from "../../ui-v2/primitives";
import { color, font } from "../../ui-v2/tokens";

const GoogleButton = dynamic(() => import("../../components/Auth/GoogleButton"), {
  ssr: false,
  loading: () => <div style={{ height: 42, width: "100%", borderRadius: 7, border: "1px solid #CFCBC0" }} />,
});

const GOOGLE_BUTTON_CLASSNAME =
  "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#CFCBC0] bg-white hover:bg-[#F7F5F0] transition-colors text-sm font-semibold text-[#14171F] disabled:opacity-50 disabled:cursor-not-allowed w-full";

type SignupRole = "student" | "teacher" | "school_admin";

const ROLE_TABS: { value: SignupRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "school_admin", label: "School" },
];

function normalizeRole(raw: unknown): SignupRole {
  return raw === "teacher" || raw === "school_admin" ? raw : "student";
}

function passwordChecks(pw: string) {
  return {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    num: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [role, setRole] = useState<SignupRole>(() => normalizeRole(router.query.role));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const score = Object.values(checks).filter(Boolean).length;
  const strengthPct = (score / 5) * 100;
  const strengthColor = score <= 2 ? color.danger.fg : score <= 3 ? color.warning.fg : color.success.fg;
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  function goHome() {
    router.push(homeForRole(role));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (!Object.values(checks).every(Boolean)) {
      setError("Password must include at least 8 characters, uppercase, lowercase, a number, and a special character.");
      return;
    }
    if (confirmMismatch) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, name, role);
      goHome();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 400) {
          if (typeof detail === "string" && detail.includes("Email already")) {
            setEmailError("An account with this email already exists");
          } else {
            setError(detail || "Password does not meet requirements");
          }
        } else {
          setError(detail || "Something went wrong. Please try again.");
        }
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
        <title>Create account — LearnPath AI</title>
      </Head>

      <AuthSplitLayout
        brandPanel={
          <>
            <Link href="/" style={{ textDecoration: "none", fontFamily: font.display, fontWeight: 600, fontSize: 20, color: color.chromeText }}>
              LearnPath
            </Link>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: font.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#C8792A", background: "#231C14", padding: "5px 11px", borderRadius: 100, marginBottom: 18 }}>
                Early access
              </div>
              <div style={{ fontFamily: font.display, fontWeight: 500, fontSize: 22, lineHeight: 1.45, maxWidth: 380, marginBottom: 16 }}>
                A watchable path, quality-scored and prerequisite-ordered — not just sorted by view count.
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#8B93AE", maxWidth: 360 }}>
                We&rsquo;re not going to print a fake user count to look bigger than we are. Build one real path and see the rubric at work for yourself.
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#5C6478" }}>© LearnPath AI · early access</div>
          </>
        }
      >
        <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 25, margin: "0 0 8px" }}>Create your account</h1>
        <p style={{ fontSize: 13.5, color: color.textFaint, margin: "0 0 22px" }}>Free to start. No card required.</p>

        <div style={{ display: "flex", gap: 4, background: color.surfaceElevated, borderRadius: 8, padding: 3, marginBottom: 22 }}>
          {ROLE_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setRole(t.value)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 0",
                flex: 1,
                borderRadius: 6,
                cursor: "pointer",
                border: "none",
                background: role === t.value ? "#fff" : "transparent",
                color: role === t.value ? color.ink : color.textFaint,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <FormError>{error}</FormError>}

        <div style={{ marginBottom: 16 }}>
          <GoogleButton onSuccess={goHome} label="Continue with Google" buttonClassName={GOOGLE_BUTTON_CLASSNAME} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: color.border }} />
          <div style={{ fontSize: 11.5, color: color.textFainter }}>or with email</div>
          <div style={{ flex: 1, height: 1, background: color.border }} />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 12 }}>
            <TextField label="Full name (optional)" placeholder="Chidinma Okafor" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <TextField
              label="Email"
              type="email"
              placeholder="student@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError ?? undefined}
              disabled={submitting}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Password</div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: font.body, border: "1px solid #CFCBC0", borderRadius: 6, background: "#fff", outline: "none", color: color.ink }}
            />
            {password && (
              <>
                <div style={{ height: 4, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ height: "100%", width: `${strengthPct}%`, background: strengthColor, borderRadius: 100 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginTop: 8 }}>
                  {[
                    ["len", "8+ characters"],
                    ["upper", "Uppercase letter"],
                    ["lower", "Lowercase letter"],
                    ["num", "A number"],
                    ["special", "Special character"],
                  ].map(([key, label]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: checks[key as keyof typeof checks] ? color.success.fg : color.textFainter }}>
                      <span>{checks[key as keyof typeof checks] ? "✓" : "○"}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{ marginBottom: 20, marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Confirm password</div>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: font.body, border: `1px solid ${confirmMismatch ? color.danger.fg : "#CFCBC0"}`, borderRadius: 6, background: "#fff", outline: "none", color: color.ink }}
            />
            {confirmMismatch && <div style={{ fontSize: 11.5, color: color.danger.fg, marginTop: 5 }}>Passwords don&rsquo;t match</div>}
          </div>
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
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ fontSize: 13, color: color.textFaint, textAlign: "center", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/auth/login" style={{ textDecoration: "none", fontWeight: 600, color: "#2B3A67" }}>
            Sign in
          </Link>
        </div>
      </AuthSplitLayout>
    </>
  );
}
