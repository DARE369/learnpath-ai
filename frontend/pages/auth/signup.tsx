import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import SignupForm from "../../components/Auth/SignupForm";
import { homeForRole } from "../../components/layout/nav";

export default function SignupPage() {
  const router = useRouter();

  function handleSuccess(_token: string, role?: string) {
    // Students land on the dashboard (the _app onboarding gate sends new students
    // to /onboarding); teachers/school admins go straight to their workspace.
    router.push(homeForRole(role));
  }

  return (
    <>
      <Head>
        <title>Create account — LearnPath AI</title>
        <meta name="description" content="Create your free LearnPath AI account and start learning smarter" />
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
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
              <span className="text-success text-xs font-medium">Free forever on the starter plan</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-5">
              Start learning
              <br />
              <span className="bg-gradient-accent bg-clip-text text-transparent">the smart way</span>
            </h1>

            <p className="text-white/50 text-lg leading-relaxed max-w-sm">
              Get a personalised curriculum built from the best educational content on YouTube — scored, structured, and sorted by AI.
            </p>

            {/* Benefits */}
            <div className="mt-10 space-y-3">
              {[
                { icon: "⚡", text: "Learning paths in under 30 seconds" },
                { icon: "🎯", text: "Quality-scored videos only (EQS ≥ 65)" },
                { icon: "🧠", text: "Prerequisite-ordered curriculum" },
                { icon: "🔒", text: "No credit card required" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-white/60 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="relative z-10 p-5 rounded-2xl bg-surface-elevated border border-border">
            <p className="text-white/70 text-sm leading-relaxed mb-3">
              &ldquo;I went from zero to deploying a full-stack app in 3 weeks. The learning path was spot-on — no fluff, just what I needed.&rdquo;
            </p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center text-xs font-bold text-white">
                S
              </div>
              <div>
                <p className="text-white text-xs font-medium">Sarah K.</p>
                <p className="text-white/35 text-xs">Software Engineer</p>
              </div>
            </div>
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

          <div className="w-full max-w-[420px]">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1.5 tracking-tight">Create your account</h2>
              <p className="text-white/45 text-sm">Join thousands learning smarter with AI</p>
            </div>

            {/* Card */}
            <div className="auth-card">
              <SignupForm onSuccess={handleSuccess} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
