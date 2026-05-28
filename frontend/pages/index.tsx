import React from "react";
import Head from "next/head";
import Link from "next/link";

const FEATURES = [
  {
    icon: "🎯",
    title: "Curated Learning Paths",
    description: "AI-assembled video sequences scored for quality, pacing, and pedagogical value.",
  },
  {
    icon: "🧠",
    title: "Active Recall",
    description: "Post-video reflection questions reinforce understanding and surface knowledge gaps.",
  },
  {
    icon: "📈",
    title: "Progress Intelligence",
    description: "Real-time dashboards track streaks, mastery, and time spent — not just clicks.",
  },
  {
    icon: "⚡",
    title: "Concept Mastery Graph",
    description: "See how concepts connect and evolve as you progress through a subject.",
  },
];

const SOCIAL_PROOF = [
  { stat: "10,000+", label: "Learning paths" },
  { stat: "98%", label: "Quality score" },
  { stat: "4.9★", label: "User rating" },
  { stat: "50K+", label: "Learners" },
];

export default function HomePage() {
  return (
    <>
      <Head>
        <title>LearnPath AI — Learn anything, faster</title>
        <meta name="description" content="AI-powered learning paths from the best educational videos on YouTube." />
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-white">
        {/* Nav */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f0f0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-white mr-auto">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-xs font-black text-white">L</span>
              </div>
              LearnPath AI
            </Link>
            <Link href="/dashboard" className="text-sm text-white/50 hover:text-white/80 transition-colors hidden sm:block">
              Dashboard
            </Link>
            <Link href="/auth/login" className="text-sm text-white/50 hover:text-white/80 transition-colors">
              Sign in
            </Link>
            <Link href="/auth/signup">
              <button className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20">
                Get started free
              </button>
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="relative pt-32 pb-24 px-6 overflow-hidden">
          {/* Background glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />
            <div className="absolute top-20 right-1/4 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl" />
          </div>

          {/* Subtle grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-xs text-indigo-300 font-medium">AI-powered · Free to start</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight mb-6">
              Learn anything.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Faster.
              </span>
            </h1>
            <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
              LearnPath AI builds personalised video curricula from the best educational content on YouTube — then tracks your progress with intelligence.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/auth/signup">
                <button className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02]">
                  Start learning free
                </button>
              </Link>
              <Link href="/dashboard">
                <button className="px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-semibold transition-all hover:bg-white/[0.03]">
                  View dashboard →
                </button>
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-8 mt-16 flex-wrap">
              {SOCIAL_PROOF.map(({ stat, label }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat}</p>
                  <p className="text-xs text-white/30 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-6 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white">Built for serious learners</h2>
              <p className="text-white/40 mt-3 text-base">Every feature is designed to maximise retention, not engagement metrics.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6 hover:border-indigo-500/20 transition-colors group"
                >
                  <div className="text-2xl mb-4">{f.icon}</div>
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 border-t border-white/[0.04]">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to start?</h2>
            <p className="text-white/40 mb-8">Free forever on the essentials. No credit card required.</p>
            <Link href="/auth/signup">
              <button className="px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base transition-all shadow-2xl shadow-indigo-500/20 hover:scale-[1.02]">
                Create free account →
              </button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.04] py-8 px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-[10px] font-black text-white">L</span>
              </div>
              LearnPath AI · {new Date().getFullYear()}
            </div>
            <div className="flex items-center gap-5 text-sm text-white/30">
              <Link href="/auth/login" className="hover:text-white/60 transition-colors">Sign in</Link>
              <Link href="/auth/signup" className="hover:text-white/60 transition-colors">Sign up</Link>
              <Link href="/dashboard" className="hover:text-white/60 transition-colors">Dashboard</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
