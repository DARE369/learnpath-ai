import React, { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { Play, ArrowRight, Video, Brain, BookOpen, Clock, ArrowUpRight, AlertTriangle } from "lucide-react";
import LearnerHome from "../components/Dashboard/LearnerHome";
import ActivityHeatmap from "../components/Dashboard/ActivityHeatmap";
import ProgressChart from "../components/Dashboard/ProgressChart";
import TopicsChart from "../components/Dashboard/TopicsChart";
import RecommendedCourses from "../components/Dashboard/RecommendedCourses";
import RecentActivity from "../components/Dashboard/RecentActivity";
import UsageAlert from "../components/Billing/UsageAlert";
import AdBanner from "../components/Ads/AdBanner";
import { Button, Card, StatTile, SectionHeader } from "../components/ui";
import { Skeleton } from "../components/ui/Skeleton";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../hooks/useAuth";
import { useDashboardData } from "../hooks/useDashboardData";
import type { UsageData } from "../components/Billing/UsageCard";

// ─── Local types ────────────────────────────────────────────────────────────

interface ReadinessScore {
  subject_id: string;
  subject_name: string;
  score: number;
  weak_topics: string[];
  score_history: number[];
  updated_at: string | null;
}

interface ActivePath {
  id: string;
  path_name: string;
  completed_modules: number;
  total_modules: number;
  progress_percent: number;
}

// ─── Section error ───────────────────────────────────────────────────────────

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padding="md" className="text-center py-8">
      <p className="text-sm text-white/50 mb-3">Failed to load data</p>
      <button
        onClick={onRetry}
        className="text-xs text-accent-light hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
      >
        Retry
      </button>
    </Card>
  );
}

// ─── Greeting helpers ────────────────────────────────────────────────────────

function getGreeting(): { emoji: string; text: string; secondary: string } {
  const h = new Date().getHours();
  if (h < 12) {
    return {
      emoji: "🌤️",
      text: "Good morning",
      secondary: "Morning learners retain more — great time to get ahead.",
    };
  }
  if (h < 17) {
    return {
      emoji: "☀️",
      text: "Good afternoon",
      secondary: "Keep the momentum going. You're doing great.",
    };
  }
  return {
    emoji: "🌙",
    text: "Good evening",
    secondary: "Evening sessions are great for review and consolidation.",
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const userPlan = user?.tier || "free";
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const greeting = getGreeting();

  const { stats, heatmap, weekly } = useProgress();

  // Time period toggle: "all" = cumulative stats, "week" = this-week sums
  const [timePeriod, setTimePeriod] = useState<"all" | "week">("all");

  const weekVideos = weekly.reduce((s, d) => s + (d.videos ?? 0), 0);
  const weekHours = weekly.reduce((s, d) => s + (d.minutes ?? 0), 0) / 60;

  const displayStats =
    timePeriod === "week"
      ? {
          videos: weekVideos,
          concepts: stats.conceptsMastered,
          courses: stats.coursesStarted,
          hours: weekHours,
        }
      : {
          videos: stats.videosWatched,
          concepts: stats.conceptsMastered,
          courses: stats.coursesStarted,
          hours: stats.hoursLearned,
        };

  // Existing sections
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [activePath, setActivePath] = useState<ActivePath | null>(null);
  const [pathLoaded, setPathLoaded] = useState(false);
  const [readinessScores, setReadinessScores] = useState<ReadinessScore[]>([]);

  // New sections via hook (recs, activity, topics)
  const {
    recs,
    recsLoading,
    recsError,
    loadRecs,
    activityItems,
    activityLoading,
    activityError,
    loadActivity,
    topicsData,
    topicsLoading,
    rateLimitCountdown,
    isRateLimited,
  } = useDashboardData();

  useEffect(() => {
    const t =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
        : null;
    if (!t) return;
    const headers = { Authorization: `Bearer ${t}` };

    fetch("/api/usage/current", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsageData(d as UsageData))
      .catch(() => {});

    fetch("/api/adaptive-paths/active", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setActivePath(d?.path ?? null))
      .catch(() => setActivePath(null))
      .finally(() => setPathLoaded(true));

    fetch("/api/curriculum/readiness", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.scores && setReadinessScores(d.scores))
      .catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <title>Dashboard — LearnPath AI</title>
      </Head>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">

        {/* ── Greeting (H1) ─────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{greeting.emoji}</span>
            {greeting.text}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-white/50">{greeting.secondary}</p>
        </div>

        {/* 429 rate-limit banner */}
        {isRateLimited && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              Too many requests. Dashboard data will refresh in{" "}
              <span className="tabular-nums font-semibold">{rateLimitCountdown}s</span>.
            </span>
          </div>
        )}

        {/* Usage limit alert */}
        {usageData && <UsageAlert data={usageData} />}

        {/* Continue learning hero */}
        <Card padding="lg" className="bg-gradient-to-r from-accent-muted via-surface to-surface">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {activePath ? (
                <>
                  <p className="text-sm text-white/50">Continue where you left off</p>
                  <h2 className="mt-1 truncate text-xl font-bold text-white">{activePath.path_name}</h2>
                  <p className="mt-1 text-sm text-white/40">
                    {activePath.completed_modules}/{activePath.total_modules} modules ·{" "}
                    {activePath.progress_percent}% complete
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white">Ready to learn something new?</h2>
                  <p className="mt-1 text-sm text-white/40">
                    {pathLoaded
                      ? "Pick a topic and we'll build a personalised path in seconds."
                      : "Loading your progress…"}
                  </p>
                </>
              )}
            </div>
            {activePath ? (
              <Button href={`/paths/${activePath.id}`} leftIcon={<Play className="h-4 w-4" />}>
                Continue learning
              </Button>
            ) : (
              <Button href="/explore" leftIcon={<ArrowRight className="h-4 w-4" />}>
                Explore topics
              </Button>
            )}
          </div>
        </Card>

        {/* Upgrade banner */}
        <AdBanner placement="banner" userPlan={userPlan} />

        {/* ── Stats grid + time period toggle (H3) ──────────────────────── */}
        <div>
          {/* Toggle */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/30 font-medium uppercase tracking-wider">Overview</p>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
              {(["all", "week"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setTimePeriod(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timePeriod === p
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {p === "all" ? "All time" : "This week"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={<Video className="h-5 w-5" />}
              label="Videos watched"
              value={displayStats.videos}
              color="accent"
              href="/activity"
            />
            <StatTile
              icon={<Brain className="h-5 w-5" />}
              label="Concepts mastered"
              value={displayStats.concepts}
              color="success"
              href="/concepts"
            />
            <StatTile
              icon={<BookOpen className="h-5 w-5" />}
              label="Courses started"
              value={displayStats.courses}
              color="info"
              href="/explore"
            />
            <StatTile
              icon={<Clock className="h-5 w-5" />}
              label={`Hours learned${timePeriod === "week" ? " (week)" : ""}`}
              value={displayStats.hours.toFixed(1)}
              color="warning"
              href="/activity"
            />
          </div>
        </div>

        {/* Progress charts */}
        <div>
          <SectionHeader title="Your Progress" subtitle="Activity and course breakdown" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProgressChart data={weekly} />
            <TopicsChart data={topicsData} isLoading={topicsLoading} />
          </div>
        </div>

        {/* Exam readiness */}
        {readinessScores.length > 0 && (
          <div>
            <SectionHeader title="Exam Readiness" subtitle="Updated after each study session" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readinessScores.map((s) => {
                const pct = s.score;
                const color =
                  pct >= 70 ? "text-green-400" : pct >= 45 ? "text-amber-400" : "text-rose-400";
                const barColor =
                  pct >= 70 ? "bg-green-500" : pct >= 45 ? "bg-amber-500" : "bg-rose-500";
                const label =
                  pct >= 80 ? "Ready" : pct >= 60 ? "On track" : pct >= 40 ? "Needs work" : "Just starting";
                return (
                  <Card key={s.subject_id} padding="md" className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{s.subject_name}</p>
                        <p className={`mt-0.5 text-xs ${color}`}>{label}</p>
                      </div>
                      <span className={`text-2xl font-bold tabular-nums ${color}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                    {s.weak_topics.length > 0 && (
                      <p className="truncate text-xs text-white/40">
                        Focus: {s.weak_topics.slice(0, 2).join(", ")}
                      </p>
                    )}
                    <Link
                      href={`/explore?q=${encodeURIComponent(s.subject_name)}&autorun=1`}
                      className="text-xs text-accent-light transition-colors hover:text-white"
                    >
                      Study now →
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Learner home: goal, performance, weekly bars, milestones, achievements */}
        <LearnerHome />

        {/* Activity heatmap */}
        <div>
          <SectionHeader title="Activity" subtitle="Your last 16 weeks" />
          <Card padding="md">
            <ActivityHeatmap data={heatmap} weeks={16} />
          </Card>
        </div>

        {/* Recommended courses */}
        <div>
          <SectionHeader
            title="Recommended for You"
            action={
              <Link
                href="/explore"
                className="inline-flex items-center gap-1 text-sm text-accent-light hover:text-white transition-colors"
              >
                See all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {recsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : recsError ? (
            <SectionError onRetry={loadRecs} />
          ) : recs && recs.length > 0 ? (
            <RecommendedCourses courses={recs} />
          ) : (
            <Card padding="md" className="py-8 text-center">
              <p className="text-sm text-white/50">
                No recommendations yet.{" "}
                <Link href="/explore" className="text-accent-light hover:text-white">
                  Explore courses
                </Link>{" "}
                to get started.
              </p>
            </Card>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <SectionHeader
            title="Recent Activity"
            action={
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-sm text-accent-light hover:text-white transition-colors"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {activityLoading ? (
            <Card padding="md" className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </Card>
          ) : activityError ? (
            <SectionError onRetry={loadActivity} />
          ) : (
            <Card padding="md">
              <RecentActivity items={activityItems ?? []} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
