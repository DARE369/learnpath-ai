import React, { useEffect, useState } from "react";
import axios from "axios";

export interface RemediatedPathSummary {
  topic_id?: string;
  videos?: Array<{
    video_id?: string;
    youtube_id: string;
    title: string;
  }>;
  video_count?: number;
  average_score?: number;
  [k: string]: unknown;
}

export interface RemediationResponse {
  success: boolean;
  tier_used: "tier_1" | "tier_2" | "tier_3";
  original_score: number;
  remediated_score: number;
  variant_query: string | null;
  notification: { state: "success" | "fallback"; message: string };
  duration_seconds: number;
  path: RemediatedPathSummary;
}

interface Props {
  open: boolean;
  query: string;
  originalScore: number;
  accessToken: string | null;
  onClose: () => void;
  onAccept: (path: RemediatedPathSummary) => void;
}

type Phase = "loading" | "result" | "error";

export default function RemediationNotification({
  open,
  query,
  originalScore,
  accessToken,
  onClose,
  onAccept,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<RemediationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setResult(null);
    setError(null);

    (async () => {
      try {
        const res = await axios.post<RemediationResponse>(
          "/api/remediation/auto-remediate",
          { query, original_score: originalScore },
          { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
        );
        if (!cancelled) {
          setResult(res.data);
          setPhase("result");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        let msg = "Remediation failed.";
        if (axios.isAxiosError(err)) {
          const detail =
            (err.response?.data as { detail?: string } | undefined)?.detail;
          msg = detail || msg;
          if (err.response?.status === 401) msg = "Please sign in to remediate.";
        }
        setError(msg);
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, query, originalScore, accessToken]);

  if (!open) return null;

  const tierLabel = result
    ? {
        tier_1: "Claude search variants",
        tier_2: "Gemini search variants",
        tier_3: "no better content found",
      }[result.tier_used]
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Auto-remediation"
    >
      <div className="w-full max-w-lg bg-surface-elevated border border-border rounded-2xl p-6 shadow-2xl">
        {phase === "loading" && (
          <div className="text-center py-4">
            <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <h2 className="text-lg font-semibold text-white mb-1">
              Finding better content…
            </h2>
            <p className="text-sm text-white/50">
              Trying alternate queries via Claude, then Gemini. This usually takes 30-90 seconds.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              Couldn&apos;t remediate
            </h2>
            <p className="text-sm text-error mb-4">{error}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-surface text-white/70 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <div>
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-white/40 mb-1">
                Remediation · {tierLabel}
              </p>
              <h2 className="text-lg font-semibold text-white">
                {result.success ? "Found a better path" : "Using the original path"}
              </h2>
              <p className="text-sm text-white/55 mt-1">
                {result.notification.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <ScoreCard label="Original score" value={result.original_score} />
              <ScoreCard
                label={result.success ? "Remediated score" : "Best available"}
                value={result.remediated_score}
                highlighted={result.success}
              />
            </div>

            {result.variant_query && (
              <div className="mb-5 p-3 bg-white/5 border border-border rounded-lg text-xs">
                <span className="text-white/40">Better query found: </span>
                <span className="text-white font-mono">{result.variant_query}</span>
              </div>
            )}

            {result.success && Array.isArray(result.path.videos) && (
              <div className="mb-5">
                <p className="text-xs uppercase tracking-wide text-white/40 mb-2">
                  Improved path · {result.path.video_count ?? result.path.videos.length} videos
                </p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {result.path.videos.slice(0, 5).map((v, i) => (
                    <li key={v.youtube_id || i} className="text-xs text-white/60 truncate">
                      {i + 1}. {v.title}
                    </li>
                  ))}
                  {result.path.videos.length > 5 && (
                    <li className="text-xs text-white/30">
                      +{result.path.videos.length - 5} more…
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-surface text-white/70 hover:text-white text-sm"
              >
                Keep original
              </button>
              {result.success && (
                <button
                  type="button"
                  onClick={() => onAccept(result.path)}
                  className="px-4 py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90"
                >
                  Use new path
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-white/30 text-right">
              completed in {result.duration_seconds.toFixed(1)}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: number;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        highlighted
          ? "border-accent/30 bg-accent-muted"
          : "border-border bg-white/5"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-2xl font-semibold ${highlighted ? "text-accent-light" : "text-white"}`}>
        {value}
        <span className="text-sm text-white/40 font-normal ml-1">/100</span>
      </div>
    </div>
  );
}
