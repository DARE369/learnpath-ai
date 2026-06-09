import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useAuth } from "../../hooks/useAuth";
import RemediationNotification, {
  RemediatedPathSummary,
} from "../RemediationNotification";

const LOW_CONFIDENCE_THRESHOLD = 60;

interface PathVideo {
  video_id: string;
  youtube_id: string;
  title: string;
  duration_minutes: number;
  eqs_score: number;
  summary: string;
  concepts: string[];
  thumbnail_url: string;
}

interface PathStats {
  videos_found: number;
  videos_used: number;
  average_quality_score: number;
  confidence: string;
  concepts_covered: number;
}

export interface BuiltPath {
  topic_id: string;
  topic_name: string;
  learning_path: PathVideo[];
  stats: PathStats;
  time_to_build_seconds: number;
  source: string;
}

interface SearchTopicFormProps {
  onBuilt?: (path: BuiltPath) => void;
}

const STAGE_MESSAGES = [
  "Searching YouTube for the best videos…",
  "Scoring video quality with AI…",
  "Reading transcripts…",
  "Generating concept summaries…",
  "Mapping prerequisites…",
  "Assembling your learning path…",
];

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function SearchTopicForm({ onBuilt }: SearchTopicFormProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuiltPath | null>(null);
  const [remediationOpen, setRemediationOpen] = useState(false);

  // "You've built this before" confirm + the user's recently-explored topics.
  interface ConfirmInfo {
    query: string;
    topicId: string | null;
    fromCache: boolean;
    exploredBefore: boolean;
    videoCount: number;
  }
  interface HistoryItem {
    query: string;
    topic_id: string;
    video_count: number;
    average_score: number;
    available: boolean;
    last_explored_at: string | null;
  }
  const [confirmInfo, setConfirmInfo] = useState<ConfirmInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const loadHistory = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get<{ history: HistoryItem[] }>("/api/search/history", {
        params: { limit: 8 },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setHistory(res.data?.history ?? []);
    } catch {
      /* non-fatal */
    }
  }, [accessToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function openTopic(topicId: string) {
    router.push(`/learning/${encodeURIComponent(topicId)}/0`);
  }

  function rotateStages() {
    const start = Date.now();
    setStageIndex(0);
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const idx = Math.min(STAGE_MESSAGES.length - 1, Math.floor(elapsed / 7));
      setStageIndex(idx);
    };
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }

  async function runSearch(rawQuery: string, forceRefresh = false) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
      setError("Please enter a topic (at least 2 characters)");
      return;
    }

    setError(null);
    setResult(null);
    setConfirmInfo(null);
    setLoading(true);
    const stopRotating = rotateStages();

    try {
      const res = await axios.post<BuiltPath>(
        "/api/search/build-path",
        { query: trimmed, use_cache: !forceRefresh, force_refresh: forceRefresh },
        { headers: authHeader },
      );
      setResult(res.data);
      onBuilt?.(res.data);
      void loadHistory();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;
        const detail = typeof data === "object" && data !== null ? (data as { detail?: string }).detail : undefined;
        if (status === 401) {
          setError("Please sign in to build a learning path.");
        } else if (status === 400) {
          setError(detail || "We couldn't build a path for that topic. Try a more specific search.");
        } else if (status === 404) {
          setError("Search endpoint not available yet. The backend may still be deploying — try again in a minute.");
        } else if (status === 502 || status === 503 || status === 504) {
          setError("Search service is temporarily unreachable (the backend may be redeploying). Try again in 30 seconds.");
        } else {
          setError(detail || "Something went wrong. Please try again.");
        }
      } else {
        setError("Network error. Check your connection.");
      }
    } finally {
      stopRotating();
      setLoading(false);
    }
  }

  // Cheap pre-build check: if a reusable path already exists or the user has
  // explored this before, ask before regenerating (saves tokens).
  async function preflight(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
      setError("Please enter a topic (at least 2 characters)");
      return;
    }
    setError(null);
    setResult(null);
    try {
      const res = await axios.get("/api/search/lookup", {
        params: { q: trimmed },
        headers: authHeader,
      });
      const d = res.data || {};
      if (d.exists || d.explored_before) {
        setConfirmInfo({
          query: trimmed,
          topicId: d.topic_id ?? null,
          fromCache: !!d.from_cache,
          exploredBefore: !!d.explored_before,
          videoCount: d.video_count ?? 0,
        });
        return;
      }
    } catch {
      /* lookup failed — fall through and just build */
    }
    await runSearch(trimmed, false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await preflight(query);
  }

  function continueExisting() {
    const info = confirmInfo;
    setConfirmInfo(null);
    if (info?.fromCache && info.topicId) {
      openTopic(info.topicId); // reuse the stored path — zero tokens
    } else if (info) {
      void runSearch(info.query, false); // serve-if-cached, else build
    }
  }

  function rebuildFresh() {
    const info = confirmInfo;
    setConfirmInfo(null);
    if (info) void runSearch(info.query, true);
  }

  // Auto-run search when arriving with ?q=...&autorun=1 — used by catalog
  // "Start course" buttons so a single click pipes a curated course title
  // through the real search pipeline. Track the last autorun query so
  // navigating to a different catalog course on the same page fires again.
  const autorunFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.q;
    const autorun = router.query.autorun;
    if (typeof q === "string" && q && autorun === "1" && autorunFiredRef.current !== q) {
      autorunFiredRef.current = q;
      setQuery(q);
      void runSearch(q);
    }
  }, [router.isReady, router.query]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStartLearning() {
    if (!result || result.learning_path.length === 0) return;
    // Stash the built path so the learning page can render it instantly without
    // a second round-trip. Falls back to GET /api/search/path/{topic_id} if missing.
    try {
      sessionStorage.setItem(`builtPath:${result.topic_id}`, JSON.stringify(result));
    } catch { /* sessionStorage unavailable — page will fetch instead */ }
    router.push(`/learning/${encodeURIComponent(result.topic_id)}/0`);
  }

  function handleRemediatedPath(remediatedPath: RemediatedPathSummary) {
    if (!result) return;
    // Merge the remediated path into our result shape so the UI updates in place.
    const videos = Array.isArray(remediatedPath.videos) ? remediatedPath.videos : [];
    const next: BuiltPath = {
      ...result,
      topic_id: (remediatedPath.topic_id as string) || result.topic_id,
      learning_path: videos.map((v) => ({
        video_id: v.video_id || v.youtube_id,
        youtube_id: v.youtube_id,
        title: v.title,
        duration_minutes: 0,
        eqs_score: 0,
        summary: "",
        concepts: [],
        thumbnail_url: "",
      })),
      stats: {
        ...result.stats,
        videos_used: videos.length,
        average_quality_score: Number(remediatedPath.average_score ?? result.stats.average_quality_score),
      },
      source: "remediated",
    };
    setResult(next);
    setRemediationOpen(false);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to learn? e.g. 'Photosynthesis'"
            className="input-field pl-11"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[160px]"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2"><Spinner />Building…</span>
          ) : (
            "Build my path"
          )}
        </button>
      </form>

      {/* "You've built this before" confirm */}
      {confirmInfo && !loading && (
        <div className="p-5 rounded-2xl bg-surface-elevated border border-accent/30 animate-fade-in">
          <p className="text-sm font-medium text-white">
            You&apos;ve explored &ldquo;{confirmInfo.query}&rdquo; before.
          </p>
          <p className="text-xs text-white/50 mt-1">
            {confirmInfo.fromCache
              ? `A ready-made path${confirmInfo.videoCount ? ` (${confirmInfo.videoCount} videos)` : ""} already exists — continue instantly, or rebuild it fresh.`
              : "Continue where you left off, or rebuild it fresh with the latest content."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={continueExisting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-onaccent text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={rebuildFresh}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              Rebuild fresh
            </button>
            <button
              type="button"
              onClick={() => setConfirmInfo(null)}
              className="px-4 py-2 rounded-xl text-white/50 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recently explored — jump back into something already built (no tokens) */}
      {!loading && !result && !confirmInfo && history.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
            Recently explored
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <button
                key={h.topic_id}
                type="button"
                onClick={() => openTopic(h.topic_id)}
                title={h.available ? `${h.video_count} videos · avg ${h.average_score}` : "Rebuilds on open"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-accent/40 hover:text-white"
              >
                {h.query}
                {h.available && h.video_count > 0 && (
                  <span className="text-xs text-white/30">· {h.video_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-error-muted border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-6 rounded-2xl bg-surface-elevated border border-border">
          <div className="flex items-center gap-3 mb-2">
            <Spinner />
            <p className="text-white font-medium text-sm">{STAGE_MESSAGES[stageIndex]}</p>
          </div>
          <p className="text-xs text-white/40">
            This can take 30–60 seconds the first time. Cached topics return instantly next time.
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4 animate-fade-in">
          {/* Stats banner */}
          <div className="p-5 rounded-2xl bg-surface-elevated border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40 mb-1">Built for you</p>
                <h3 className="text-xl font-semibold text-white">{result.topic_name}</h3>
                <p className="text-xs text-white/40 mt-1">
                  {result.source === "cache"
                    ? "Loaded from cache"
                    : `Built in ${result.time_to_build_seconds.toFixed(1)}s`}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{result.stats.videos_used}</p>
                  <p className="text-xs text-white/40">videos</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{result.stats.average_quality_score}</p>
                  <p className="text-xs text-white/40">avg score</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-accent-light">{result.stats.confidence}</p>
                  <p className="text-xs text-white/40">confidence</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleStartLearning}
                disabled={result.learning_path.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Start learning
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              {result.stats.average_quality_score < LOW_CONFIDENCE_THRESHOLD && (
                <button
                  type="button"
                  onClick={() => setRemediationOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-warning-muted text-warning text-sm font-medium hover:bg-warning-muted/80 transition-colors"
                  title={`This path scored ${result.stats.average_quality_score}/100 — below the ${LOW_CONFIDENCE_THRESHOLD}-point quality threshold.`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                  Find better content
                </button>
              )}
            </div>
          </div>

          {/* Video list */}
          {result.learning_path.length > 0 ? (
            <ol className="space-y-2">
              {result.learning_path.map((video, i) => (
                <li
                  key={video.video_id || video.youtube_id || i}
                  className="flex items-start gap-4 p-4 bg-surface-elevated border border-border rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-muted text-accent-light flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug mb-1 truncate">
                      {video.title || "Untitled video"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      {video.duration_minutes > 0 && <span>{video.duration_minutes} min</span>}
                      {video.eqs_score > 0 && <span>EQS {Math.round(video.eqs_score)}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="p-6 text-center text-white/50 bg-surface-elevated border border-border rounded-xl text-sm">
              Path built, but no videos passed the quality filter for this query.
              Try a more common topic.
            </div>
          )}
        </div>
      )}

      {result && (
        <RemediationNotification
          open={remediationOpen}
          query={result.topic_name}
          originalScore={result.stats.average_quality_score}
          accessToken={accessToken}
          onClose={() => setRemediationOpen(false)}
          onAccept={handleRemediatedPath}
        />
      )}
    </div>
  );
}
