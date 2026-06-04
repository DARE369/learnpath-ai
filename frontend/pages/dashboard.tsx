import React, { useState, useEffect } from "react";
import Head from "next/head";
import { Play, ArrowRight, Video, Brain, BookOpen, Clock } from "lucide-react";
import LearnerHome from "../components/Dashboard/LearnerHome";
import ActivityHeatmap from "../components/Dashboard/ActivityHeatmap";
import UsageAlert from "../components/Billing/UsageAlert";
import AdBanner from "../components/Ads/AdBanner";
import { Button, Card, StatTile, SectionHeader } from "../components/ui";
import { useProgress } from "../hooks/useProgress";
import { useAuth } from "../hooks/useAuth";
import type { UsageData } from "../components/Billing/UsageCard";

interface ActivePath {
  id: string;
  path_name: string;
  completed_modules: number;
  total_modules: number;
  progress_percent: number;
}

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userPlan = user?.tier || "free";

  const { stats, heatmap } = useProgress();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [activePath, setActivePath] = useState<ActivePath | null>(null);
  const [pathLoaded, setPathLoaded] = useState(false);

  useEffect(() => {
    const headers = authHeaders();
    if (!headers.Authorization) return;
    fetch("/api/usage/current", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsageData(d as UsageData))
      .catch(() => {});
    fetch("/api/adaptive-paths/active", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setActivePath(d?.path ?? null))
      .catch(() => setActivePath(null))
      .finally(() => setPathLoaded(true));
  }, []);

  return (
    <>
      <Head>
        <title>Dashboard — LearnPath AI</title>
      </Head>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Usage limit alert — shown when any metric exceeds 80% */}
        {usageData && <UsageAlert data={usageData} />}

        {/* Continue learning hero */}
        <Card padding="lg" className="bg-gradient-to-r from-accent-muted via-surface to-surface">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {activePath ? (
                <>
                  <p className="text-sm text-white/50">Continue where you left off</p>
                  <h1 className="mt-1 truncate text-2xl font-bold text-white">{activePath.path_name}</h1>
                  <p className="mt-1 text-sm text-white/40">
                    {activePath.completed_modules}/{activePath.total_modules} modules · {activePath.progress_percent}% complete
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-white">Ready to learn something new?</h1>
                  <p className="mt-1 text-sm text-white/40">
                    {pathLoaded ? "Pick a topic and we'll build a personalised path in seconds." : "Loading your progress…"}
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

        {/* Upgrade banner — only shown to free users, dismissable */}
        <AdBanner placement="banner" userPlan={userPlan} />

        {/* Stats grid — real data from /api/progress/stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={<Video className="h-5 w-5" />} label="Videos watched" value={stats.videosWatched} color="accent" />
          <StatTile icon={<Brain className="h-5 w-5" />} label="Concepts mastered" value={stats.conceptsMastered} color="success" />
          <StatTile icon={<BookOpen className="h-5 w-5" />} label="Courses started" value={stats.coursesStarted} color="info" />
          <StatTile icon={<Clock className="h-5 w-5" />} label="Hours learned" value={stats.hoursLearned.toFixed(1)} color="warning" />
        </div>

        {/* Real learner dashboard: goal, performance, weekly, milestones, achievements, buddies */}
        <LearnerHome />

        {/* Activity heatmap (real) */}
        <div>
          <SectionHeader title="Activity" subtitle="Your last 16 weeks" />
          <Card padding="md">
            <ActivityHeatmap data={heatmap} weeks={16} />
          </Card>
        </div>
      </div>
    </>
  );
}
