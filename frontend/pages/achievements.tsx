import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import AchievementBadges from "../components/Dashboard/AchievementBadges";
import { Card, SectionHeader } from "../components/ui";
import { Skeleton } from "../components/ui/Skeleton";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress?: number;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const h = authHeaders();
      let unlocked: Achievement[] = [];
      let locked: Achievement[] = [];

      // Try dedicated achievements endpoint first
      const achRes = await fetch("/api/achievements/", { headers: h });
      if (achRes.ok) {
        const d = await achRes.json();
        const all: Achievement[] = d?.achievements ?? [];
        unlocked = all.filter((a) => a.unlockedAt);
        locked = all.filter((a) => !a.unlockedAt);
      } else {
        // Fall back to the dashboard endpoint which we know returns achievements
        const dashRes = await fetch("/api/dashboard/", { headers: h });
        if (dashRes.ok) {
          const d = await dashRes.json();
          unlocked = (d?.achievements?.unlocked ?? []).map((a: Achievement) => ({
            ...a,
            unlockedAt: "unlocked",
          }));
          locked = d?.achievements?.locked ?? [];
        }
      }

      setAchievements([...unlocked, ...locked]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <>
      <Head>
        <title>Achievements — LearnPath AI</title>
      </Head>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="text-white/40 hover:text-white/70 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
          <span className="text-white/70">Achievements</span>
        </nav>

        <SectionHeader
          title="Your Achievements"
          subtitle={
            loading
              ? "Loading…"
              : `${unlockedCount} of ${achievements.length} unlocked`
          }
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm text-white/50 mb-3">Failed to load achievements</p>
            <button
              onClick={load}
              className="text-xs text-accent-light hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
            >
              Retry
            </button>
          </Card>
        ) : achievements.length === 0 ? (
          <Card padding="lg" className="flex flex-col items-center py-16 text-center">
            <Trophy className="h-12 w-12 text-white/10 mb-4" />
            <p className="text-sm font-medium text-white/50 mb-1">No achievements yet</p>
            <p className="text-xs text-white/30 mb-4">
              Keep learning to unlock your first achievement.
            </p>
            <Link
              href="/explore"
              className="text-xs text-accent-light hover:text-white transition-colors"
            >
              Explore courses →
            </Link>
          </Card>
        ) : (
          <AchievementBadges achievements={achievements} />
        )}
      </div>
    </>
  );
}
