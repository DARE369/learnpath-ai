import { useState, useCallback, useEffect } from "react";
import { api, ApiRequestError } from "../lib/api";
import { useErrorHandler } from "./useErrorHandler";
import type { TopicsData } from "../components/Dashboard/TopicsChart";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  category: string;
  videoCount: number;
  durationMinutes: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  matchScore: number;
  gradient: string;
  icon: string;
}

export interface ActivityItem {
  id: string;
  type: "video_watched" | "course_started" | "achievement" | "concept_mastered" | "answered";
  title: string;
  subtitle?: string;
  timestamp: string;
  pathId?: string;
  videoIndex?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token");
}

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];
const ICONS = ["📚", "🎓", "💡", "🚀", "⚡", "🧠", "🔬", "📊"];

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const VALID_DIFFICULTY = ["Beginner", "Intermediate", "Advanced"] as const;

export function mapCourse(raw: Record<string, unknown>): Course {
  const id = String(raw.id ?? "");
  const h = hashString(id || String(raw.title ?? ""));
  return {
    id,
    title: String(raw.title ?? ""),
    category: String(raw.category ?? raw.subtitle ?? raw.description ?? "Course")
      .split(" ")
      .slice(0, 4)
      .join(" "),
    videoCount: Number(raw.videoCount ?? raw.video_count ?? 0),
    durationMinutes: raw.durationMinutes
      ? Number(raw.durationMinutes)
      : raw.duration
        ? Math.round(Number(raw.duration) * 60)
        : 0,
    difficulty: VALID_DIFFICULTY.includes(raw.difficulty as (typeof VALID_DIFFICULTY)[number])
      ? (raw.difficulty as Course["difficulty"])
      : "Beginner",
    matchScore: Number(raw.matchScore ?? raw.match_score ?? 0),
    gradient: String(raw.gradient ?? GRADIENTS[h % GRADIENTS.length]),
    icon: String(raw.icon ?? ICONS[h % ICONS.length]),
  };
}

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

export function mapActivity(raw: Record<string, unknown>): ActivityItem {
  return {
    id: String(raw.id ?? Math.random()),
    type: ACTIVITY_TYPE_MAP[String(raw.type ?? "")] ?? "video_watched",
    title: String(raw.title ?? ""),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    pathId: raw.pathId ? String(raw.pathId) : raw.path_id ? String(raw.path_id) : undefined,
    videoIndex:
      raw.videoIndex !== undefined
        ? Number(raw.videoIndex)
        : raw.video_index !== undefined
          ? Number(raw.video_index)
          : undefined,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData() {
  // Shared rate-limit error handler — any of the three fetches can trigger it.
  const { countdown, isRateLimited, handleError } = useErrorHandler();

  const [recs, setRecs] = useState<Course[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState(false);

  const [activityItems, setActivityItems] = useState<ActivityItem[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);

  const [topicsData, setTopicsData] = useState<TopicsData | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const loadRecs = useCallback(async () => {
    setRecsLoading(true);
    setRecsError(false);
    try {
      const d = await api.get<{ courses: unknown[] }>("/api/dashboard/recommendations");
      setRecs((d.courses ?? []).map((c) => mapCourse(c as Record<string, unknown>)));
    } catch (err) {
      handleError(err);
      // Only mark section as errored for non-429 failures; 429 shows the global banner.
      if (!(err instanceof ApiRequestError && err.status === 429)) {
        setRecsError(true);
      }
    } finally {
      setRecsLoading(false);
    }
  }, [handleError]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(false);
    try {
      const d = await api.get<{ activities: unknown[] }>("/api/dashboard/activity");
      setActivityItems(
        (d.activities ?? []).slice(0, 8).map((a) => mapActivity(a as Record<string, unknown>)),
      );
    } catch (err) {
      handleError(err);
      if (!(err instanceof ApiRequestError && err.status === 429)) {
        setActivityError(true);
      }
    } finally {
      setActivityLoading(false);
    }
  }, [handleError]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    try {
      // Backend returns { completed, inProgress, notStarted } directly.
      const d = await api.get<TopicsData>("/api/dashboard/progress");
      setTopicsData(d ?? null);
    } catch (err) {
      handleError(err);
      // Topics chart degrades silently to empty state on any error.
    } finally {
      setTopicsLoading(false);
    }
  }, [handleError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!getToken()) return;
    loadRecs();
    loadActivity();
    loadTopics();
  }, [loadRecs, loadActivity, loadTopics]);

  return {
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
    // Rate-limit state surfaced from useErrorHandler
    rateLimitCountdown: countdown,
    isRateLimited,
  };
}
