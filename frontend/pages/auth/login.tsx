import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import LoginForm from "../../components/Auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();

  function handleSuccess() {
    router.push("/");
  }

  return (
    <>
      <Head>
        <title>Sign in — LearnPath AI</title>
        <meta name="description" content="Sign in to your LearnPath AI account" />
      </Head>

      <div className="min-h-screen bg-background flex">
        {/* Left panel — branding */}
        <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 overflow-hidden">
          {/* Background glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 40%, rgba(99,102,241,0.18) 0%, transparent 65%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.12) 0%, transparent 55%)",
            }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Logo */}
          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-white font-semibold text-lg tracking-tight">LearnPath AI</span>
            </Link>
          </div>

          {/* Hero copy */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted border border-accent/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
              <span className="text-accent-light text-xs font-medium">AI-powered learning paths</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-5">
              Master anything,
              <br />
              <span className="bg-gradient-accent bg-clip-text text-transparent">faster than ever</span>
            </h1>

            <p className="text-white/50 text-lg leading-relaxed max-w-sm">
              LearnPath AI curates the best YouTube content and builds your personalised learning path — all powered by Claude.
            </p>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {["#6366f1", "#8b5cf6", "#06b6d4", "#10b981"].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: color }}
                  >
                    {["A", "B", "C", "D"][i]}
                  </div>
                ))}
              </div>
              <p className="text-white/40 text-sm">
                <span className="text-white font-medium">2,400+</span> learners already inside
              </p>
            </div>
          </div>

          {/* Feature pills */}
          <div className="relative z-10 flex flex-wrap gap-2">
            {[
              "EQS Quality Scoring",
              "Concept Graphs",
              "Auto Learning Paths",
              "Claude AI Powered",
            ].map((feat) => (
              <span
                key={feat}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-white/50 text-xs"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-white font-semibold text-lg tracking-tight">LearnPath AI</span>
            </Link>
          </div>

          <div className="w-full max-w-[400px]">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1.5 tracking-tight">Welcome back</h2>
              <p className="text-white/45 text-sm">Sign in to continue your learning journey</p>
            </div>

            {/* Card */}
            <div className="auth-card">
              <LoginForm onSuccess={handleSuccess} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
