import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";
import StatsCard from "../components/Dashboard/StatsCard";
import AchievementBadges from "../components/Dashboard/AchievementBadges";
import ProgressChart from "../components/Dashboard/ProgressChart";
import ActivityHeatmap from "../components/Dashboard/ActivityHeatmap";
import RecentActivity from "../components/Dashboard/RecentActivity";
import RecommendedCourses from "../components/Dashboard/RecommendedCourses";
import UsageAlert from "../components/Billing/UsageAlert";
import AdBanner from "../components/Ads/AdBanner";
import SuccessStoriesWidget from "../components/Success/SuccessStoriesWidget";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../hooks/useAuth";
import type { UsageData } from "../components/Billing/UsageCard";

// ─── Icons ────────────────────────────────────────────────────────────────────

const VideoIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);
const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ─── Demo data for surfaces without backend yet ──────────────────────────────
// Achievements, recent activity, and recommended courses don't have backing
// tables/endpoints — kept as static placeholders. Stats / streak / weekly
// activity / heatmap now load from /api/progress/* via useProgress.

const EMPTY_WEEKLY = [
  { date: "Mon", videos: 0, minutes: 0 },
  { date: "Tue", videos: 0, minutes: 0 },
  { date: "Wed", videos: 0, minutes: 0 },
  { date: "Thu", videos: 0, minutes: 0 },
  { date: "Fri", videos: 0, minutes: 0 },
  { date: "Sat", videos: 0, minutes: 0 },
  { date: "Sun", videos: 0, minutes: 0 },
];

const DEMO_ACHIEVEMENTS = [
  { id: "1", name: "First Step", description: "Watched your first video", icon: "🎬", unlockedAt: "2026-05-01", rarity: "common" as const },
  { id: "2", name: "Week Warrior", description: "7-day learning streak", icon: "🔥", unlockedAt: "2026-05-15", rarity: "rare" as const },
  { id: "3", name: "Deep Diver", description: "Watched a 60+ min video", icon: "🌊", unlockedAt: "2026-05-20", rarity: "common" as const },
  { id: "4", name: "Quiz Master", description: "Score 90%+ on 10 quizzes", icon: "🎯", progress: 60, rarity: "epic" as const },
  { id: "5", name: "Polymath", description: "Master 5 different topics", icon: "🧠", progress: 40, rarity: "epic" as const },
  { id: "6", name: "Speed Runner", description: "Finish a course in one day", icon: "⚡", progress: 0, rarity: "legendary" as const },
  { id: "7", name: "Consistent", description: "30-day streak", icon: "🗓️", progress: 23, rarity: "rare" as const },
  { id: "8", name: "Scholar", description: "100 videos watched", icon: "🎓", progress: 24, rarity: "epic" as const },
];

const DEMO_ACTIVITY = [
  { id: "1", type: "video_watched" as const, title: "Watched 'Backpropagation Explained'", subtitle: "Machine Learning Path", timestamp: new Date(Date.now() - 25 * 60000).toISOString(), pathId: "demo", videoIndex: 3 },
  { id: "2", type: "concept_mastered" as const, title: "Mastered 'Gradient Descent'", subtitle: "+12 mastery score", timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "3", type: "achievement" as const, title: "Unlocked 'Week Warrior' badge", subtitle: "7-day learning streak achieved! 🔥", timestamp: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "4", type: "video_watched" as const, title: "Watched 'Neural Networks Explained'", subtitle: "Machine Learning Path", timestamp: new Date(Date.now() - 26 * 3600000).toISOString(), pathId: "demo", videoIndex: 2 },
  { id: "5", type: "course_started" as const, title: "Started 'Python for Data Science'", subtitle: "4 videos · 2h 30m", timestamp: new Date(Date.now() - 48 * 3600000).toISOString() },
];

const DEMO_COURSES = [
  {
    id: "ml-fundamentals",
    title: "Machine Learning Fundamentals",
    category: "Artificial Intelligence",
    videoCount: 12,
    durationMinutes: 180,
    difficulty: "Beginner" as const,
    matchScore: 97,
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
    icon: "🤖",
  },
  {
    id: "deep-learning",
    title: "Deep Learning with PyTorch",
    category: "Neural Networks",
    videoCount: 18,
    durationMinutes: 340,
    difficulty: "Intermediate" as const,
    matchScore: 89,
    gradient: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    icon: "🧪",
  },
  {
    id: "nlp-transformers",
    title: "NLP & Transformer Models",
    category: "Natural Language Processing",
    videoCount: 15,
    durationMinutes: 260,
    difficulty: "Advanced" as const,
    matchScore: 82,
    gradient: "linear-gradient(135deg, #4a1942 0%, #6b21a8 50%, #7c3aed 100%)",
    icon: "💬",
  },
];

// ─── Streak flame ─────────────────────────────────────────────────────────────

function StreakBadge({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
      <span className="text-2xl">🔥</span>
      <div>
        <p className="text-lg font-bold text-orange-400 leading-none tabular-nums">{days}</p>
        <p className="text-[11px] text-orange-400/60 mt-0.5">day streak</p>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/30 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const userPlan = user?.tier || "free";

  // Real data from the backend via useProgress (calls /api/progress/*)
  const { stats: realStats, streak, weekly, heatmap } = useProgress();

  const stats = {
    videosWatched: realStats.videosWatched,
    conceptsMastered: realStats.conceptsMastered,
    coursesStarted: realStats.coursesStarted,
    hoursLearned: realStats.hoursLearned,
  };

  // Weekly chart: backend returns 7 entries (Mon-Sun). Fall back to empty week
  // shape while loading so the chart axes render correctly.
  const chartData = weekly.length === 7 ? weekly : EMPTY_WEEKLY;

  // Try to load user name and usage data from stored token
  useEffect(() => {
    const token =
      localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    axios
      .get("/api/auth/me", { headers })
      .then((res) => setUserName(res.data.full_name ?? res.data.email?.split("@")[0] ?? null))
      .catch(() => {});
    axios
      .get("/api/usage/current", { headers })
      .then((res) => setUsageData(res.data as UsageData))
      .catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <>
      <Head>
        <title>Dashboard — LearnPath AI</title>
      </Head>

      <div className="min-h-screen bg-[#0f0f0f] text-white">
        {/* Top nav */}
        <header className="sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 font-bold text-white mr-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-xs font-black text-white">L</span>
              </div>
              <span className="text-sm hidden sm:block">LearnPath AI</span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1 flex-1">
              <Link href="/dashboard" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-white/5">
                Dashboard
              </Link>
              <Link href="/explore" className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors">
                Explore
              </Link>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <StreakBadge days={streak} />
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                {userName?.[0]?.toUpperCase() ?? "U"}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Usage limit alert — shown when any metric exceeds 80% */}
          {usageData && <UsageAlert data={usageData} />}

          {/* Welcome banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-[#141414] border border-indigo-500/20 p-6">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(ellipse at top right, rgba(99,102,241,0.3) 0%, transparent 60%)" }} />
            <div className="relative flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-white/50 text-sm">{greeting()}{userName ? `, ${userName}` : ""} 👋</p>
                <h1 className="text-2xl font-bold text-white mt-1">
                  Keep up that {streak}-day streak!
                </h1>
                <p className="text-white/40 text-sm mt-1">You&apos;re on a roll. Don&apos;t break the chain.</p>
              </div>
              <Link href="/learning/demo/0">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Continue Learning
                </button>
              </Link>
            </div>
          </div>

          {/* Upgrade banner — only shown to free users, dismissable */}
          <AdBanner placement="banner" userPlan={userPlan} />

          {/* Stats grid — real data from /api/progress/stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              icon={<VideoIcon />}
              label="Videos Watched"
              value={stats.videosWatched}
              color="blue"
            />
            <StatsCard
              icon={<BrainIcon />}
              label="Concepts Mastered"
              value={stats.conceptsMastered}
              color="green"
            />
            <StatsCard
              icon={<BookIcon />}
              label="Courses Started"
              value={stats.coursesStarted}
              color="purple"
            />
            <StatsCard
              icon={<ClockIcon />}
              label="Hours Learned"
              value={stats.hoursLearned.toFixed(1)}
              color="orange"
            />
          </div>

          {/* Chart + Activity (2/3 + 1/3) */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-6">
            <ProgressChart data={chartData} />

            {/* Today's goal */}
            <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-5 flex flex-col">
              <h3 className="text-sm font-semibold text-white mb-4">Today&apos;s Goal</h3>
              <div className="space-y-4 flex-1">
                {[
                  { label: "Watch 2 videos", done: true, current: 2, total: 2 },
                  { label: "Learn 30 minutes", done: false, current: 24, total: 30, unit: "min" },
                  { label: "Answer 1 question", done: false, current: 0, total: 1 },
                ].map((goal) => (
                  <div key={goal.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {goal.done ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                        <span className={`text-xs ${goal.done ? "text-white/40 line-through" : "text-white/70"}`}>
                          {goal.label}
                        </span>
                      </div>
                      <span className="text-xs text-white/30 tabular-nums">
                        {goal.current}/{goal.total}{goal.unit ? goal.unit : ""}
                      </span>
                    </div>
                    <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${goal.done ? "bg-emerald-500" : "bg-indigo-500/60"}`}
                        style={{ width: `${Math.min(100, (goal.current / goal.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>1/3 goals complete</span>
                  <span className="text-indigo-400 font-medium">33%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <ActivityHeatmap data={heatmap} weeks={16} />

          {/* Achievements */}
          <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-6">
            <SectionHeader
              title="Achievements"
              subtitle={`${DEMO_ACHIEVEMENTS.filter((a) => a.unlockedAt).length} of ${DEMO_ACHIEVEMENTS.length} unlocked`}
              action={
                <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  View all
                </button>
              }
            />
            <AchievementBadges achievements={DEMO_ACHIEVEMENTS} />
          </div>

          {/* Bottom two-column: Activity + Recommended */}
          <div className="grid lg:grid-cols-[1fr_340px] gap-6">
            {/* Recommended courses */}
            <div>
              <SectionHeader
                title="Recommended For You"
                subtitle="Based on your learning history"
                action={
                  <Link href="/explore" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    Browse all →
                  </Link>
                }
              />
              <RecommendedCourses courses={DEMO_COURSES} />
            </div>

            {/* Recent activity */}
            <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-5">
              <SectionHeader
                title="Recent Activity"
                subtitle="Your last sessions"
              />
              <RecentActivity items={DEMO_ACTIVITY} />
            </div>

            {/* Success stories — shown to all users, extra motivation */}
            <SuccessStoriesWidget />
          </div>
        </main>
      </div>
    </>
  );
}
