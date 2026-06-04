import React, { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Target, Brain, TrendingUp, Network, GraduationCap, Users, School, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../components/layout/nav";

const FEATURES = [
  { icon: Target, title: "Curated Learning Paths", description: "AI-assembled video sequences scored for quality, pacing, and pedagogical value." },
  { icon: Brain, title: "Active Recall", description: "Post-video reflection questions reinforce understanding and surface knowledge gaps." },
  { icon: TrendingUp, title: "Progress Intelligence", description: "Real-time dashboards track streaks, mastery, and time spent — not just clicks." },
  { icon: Network, title: "Concept Mastery Graph", description: "See how concepts connect and evolve as you progress through a subject." },
];

const SOCIAL_PROOF = [
  { stat: "10,000+", label: "Learning paths" },
  { stat: "98%", label: "Quality score" },
  { stat: "4.9", label: "User rating" },
  { stat: "50K+", label: "Learners" },
];

const ROLES = [
  { value: "student", label: "Student", description: "Build a personalised path and learn at your own pace.", icon: GraduationCap },
  { value: "teacher", label: "Teacher", description: "Track classes, spot at-risk students, assign content.", icon: Users },
  { value: "school_admin", label: "School", description: "Oversee teachers, students and performance org-wide.", icon: School },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, user, router]);

  return (
    <>
      <Head>
        <title>LearnPath AI — Learn anything, faster</title>
        <meta name="description" content="AI-powered learning paths from the best educational videos on YouTube." />
      </Head>

      <div className="min-h-screen bg-background text-white">
        {/* Nav */}
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
            <Link href="/" className="mr-auto flex items-center gap-2.5 font-bold text-white">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-accent">
                <span className="text-xs font-black text-white">L</span>
              </div>
              LearnPath AI
            </Link>
            <Link href="/auth/login" className="text-sm text-white/50 transition-colors hover:text-white/80">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow-sm transition-colors hover:bg-accent-hover"
            >
              Get started free
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-24 pt-32">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2">
            <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute right-1/4 top-20 h-48 w-48 rounded-full bg-purple-600/15 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-muted px-4 py-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
              <span className="text-xs font-medium text-accent-light">AI-powered · Free to start</span>
            </div>

            <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
              Learn anything.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Faster.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-white/50">
              LearnPath AI builds personalised video curricula from the best educational content on YouTube — then tracks your progress with intelligence.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/auth/signup"
                className="rounded-xl bg-accent px-8 py-3.5 font-semibold text-white shadow-glow-accent transition-all hover:scale-[1.02] hover:bg-accent-hover"
              >
                Start learning free
              </Link>
              <Link
                href="/auth/login"
                className="rounded-xl border border-border px-8 py-3.5 font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.03] hover:text-white"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
              {SOCIAL_PROOF.map(({ stat, label }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat}</p>
                  <p className="mt-0.5 text-xs text-white/30">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Choose your path (role entry) */}
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-white">Choose your path</h2>
              <p className="mt-3 text-base text-white/40">LearnPath works for learners, teachers, and whole institutions.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <Link
                    key={r.value}
                    href={`/auth/signup?role=${r.value}`}
                    className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/40 hover:bg-surface-elevated"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-muted text-accent-light">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-1 flex items-center gap-1.5 text-base font-semibold text-white">
                      {r.label}
                      <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </h3>
                    <p className="text-sm leading-relaxed text-white/40">{r.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold text-white">Built for serious learners</h2>
              <p className="mt-3 text-base text-white/40">Every feature is designed to maximise retention, not engagement metrics.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/20">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-muted text-accent-light">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-white">{f.title}</h3>
                    <p className="text-sm leading-relaxed text-white/40">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">Ready to start?</h2>
            <p className="mb-8 text-white/40">Free forever on the essentials. No credit card required.</p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-accent px-10 py-4 text-base font-bold text-white shadow-glow-accent transition-all hover:scale-[1.02]"
            >
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-white/30">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-accent">
                <span className="text-[10px] font-black text-white">L</span>
              </div>
              LearnPath AI · {new Date().getFullYear()}
            </div>
            <div className="flex items-center gap-5 text-sm text-white/30">
              <Link href="/auth/login" className="transition-colors hover:text-white/60">Sign in</Link>
              <Link href="/auth/signup" className="transition-colors hover:text-white/60">Sign up</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
