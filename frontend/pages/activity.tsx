import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import RecentActivity from "../components/Dashboard/RecentActivity";
import { Card, SectionHeader } from "../components/ui";
import { Skeleton } from "../components/ui/Skeleton";

interface ActivityItem {
  id: string;
  type: "video_watched" | "course_started" | "achievement" | "concept_mastered" | "answered";
  title: string;
  subtitle?: string;
  timestamp: string;
  pathId?: string;
  videoIndex?: number;
}

const PAGE_SIZE = 20;

const ACTIVITY_TYPE_MAP: Record<string, ActivityItem["type"]> = {
  video_watched: "video_watched",
  completed: "video_watched",
  course_started: "course_started",
  started: "course_started",
  achievement: "achievement",
  badge: "achievement",
  concept_mastered: "concept_mastered",
  mastered: "concept_mastered",
  answered: "answered",
  quiz_answered: "answered",
  question_answered: "answered",
};

function authHeaders(): Record<string, string> {
  const t =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token")
      : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function mapActivity(raw: Record<string, unknown>): ActivityItem {
  return {
    id: String(raw.id ?? Math.random()),
    type: ACTIVITY_TYPE_MAP[String(raw.type ?? "")] ?? "video_watched",
    title: String(raw.title ?? ""),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    pathId: raw.pathId
      ? String(raw.pathId)
      : raw.path_id
        ? String(raw.path_id)
        : undefined,
    videoIndex:
      raw.videoIndex !== undefined
        ? Number(raw.videoIndex)
        : raw.video_index !== undefined
          ? Number(raw.video_index)
          : undefined,
  };
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (pageOffset: number, replace: boolean) => {
    if (replace) {
      setLoading(true);
      setError(false);
    } else {
      setLoadingMore(true);
    }
    try {
      const r = await fetch(
        `/api/dashboard/activity?limit=${PAGE_SIZE}&offset=${pageOffset}`,
        { headers: authHeaders() },
      );
      const d = r.ok ? await r.json() : null;
      const fetched: ActivityItem[] = (d?.activities ?? []).map(
        (a: Record<string, unknown>) => mapActivity(a),
      );
      setItems((prev) => (replace ? fetched : [...prev, ...fetched]));
      setHasMore(fetched.length === PAGE_SIZE);
      setOffset(pageOffset + PAGE_SIZE);
    } catch {
      if (replace) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPage(0, true);
  }, [loadPage]);

  function loadMore() {
    if (!loadingMore && hasMore) loadPage(offset, false);
  }

  return (
    <>
      <Head>
        <title>Activity — LearnPath AI</title>
      </Head>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="text-white/40 hover:text-white/70 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
          <span className="text-white/70">Activity</span>
        </nav>

        <SectionHeader
          title="All Activity"
          subtitle="Your complete learning history"
        />

        {loading ? (
          <Card padding="md" className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </Card>
        ) : error ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm text-white/50 mb-3">Failed to load activity</p>
            <button
              onClick={() => loadPage(0, true)}
              className="text-xs text-accent-light hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
            >
              Retry
            </button>
          </Card>
        ) : items.length === 0 ? (
          <Card padding="lg" className="flex flex-col items-center py-16 text-center">
            <Clock className="h-12 w-12 text-white/10 mb-4" />
            <p className="text-sm font-medium text-white/50 mb-1">No activity yet</p>
            <p className="text-xs text-white/30 mb-4">
              Start learning to see your history here.
            </p>
            <Link
              href="/explore"
              className="text-xs text-accent-light hover:text-white transition-colors"
            >
              Explore courses →
            </Link>
          </Card>
        ) : (
          <>
            <Card padding="md">
              <RecentActivity items={items} />
            </Card>

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-accent-light hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
