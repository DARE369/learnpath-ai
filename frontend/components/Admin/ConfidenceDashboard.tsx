import React, { useCallback, useEffect, useMemo, useState } from "react";
import { config } from "../../env.config";

interface ScoreRow {
  id: string;
  youtube_id: string;
  base_scores: Record<string, number>;
  bonus_scores: Record<string, number>;
  base_score: number;
  bonus_total: number;
  total_score: number;
  confidence_level: string;
  cache_ttl_days: number;
  reasoning: string;
  evaluated_at: string | null;
  next_reevaluation_at: string | null;
}

interface Stats {
  total_scored: number;
  average_score: number | null;
  median_score: number | null;
  distribution: Record<string, number>;
  criteria_averages: Record<string, number>;
  cache_distribution: Record<string, number>;
}

const CONFIDENCE_ORDER = ["outstanding", "excellent", "good", "acceptable", "poor"];
const CONFIDENCE_COLOR: Record<string, string> = {
  outstanding: "bg-emerald-500/20 text-emerald-300",
  excellent: "bg-indigo-500/20 text-indigo-300",
  good: "bg-sky-500/20 text-sky-300",
  acceptable: "bg-amber-500/20 text-amber-300",
  poor: "bg-rose-500/20 text-rose-300",
};

// Order + max values match the backend service constants
const BASE_CRITERIA: Array<[string, number]> = [
  ["pedagogy", 40],
  ["clarity", 30],
  ["credibility", 20],
  ["length", 10],
];
const BONUS_CRITERIA: Array<[string, number]> = [
  ["engagement", 15],
  ["production", 12],
  ["recency", 8],
  ["accessibility", 10],
  ["student_feedback", 10],
  ["curriculum_align", 8],
  ["diversity", 7],
];

function pretty(key: string): string {
  return key.replace(/_/g, " ");
}

export default function ConfidenceDashboard() {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "all" ? "" : `?confidence_level=${filter}`;
      const [listRes, statsRes] = await Promise.all([
        fetch(`${config.apiUrl}/api/eqs/expanded/list${qs}`),
        fetch(`${config.apiUrl}/api/eqs/expanded/stats`),
      ]);
      if (!listRes.ok) throw new Error(`List failed: ${listRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats failed: ${statsRes.status}`);
      const listJson = await listRes.json();
      const statsJson = await statsRes.json();
      setRows(listJson.items || []);
      setStats(statsJson);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const histogramMax = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...Object.values(stats.distribution));
  }, [stats]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Confidence Dashboard</h1>
        <p className="text-sm text-white/50 mt-1">
          Expanded EQS scoring: 11 weighted criteria, max 170 points. Score-dependent cache TTL.
        </p>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Videos scored" value={stats?.total_scored ?? "—"} />
        <StatCard label="Average" value={stats?.average_score?.toFixed(1) ?? "—"} suffix="/170" />
        <StatCard label="Median" value={stats?.median_score?.toString() ?? "—"} suffix="/170" />
        <StatCard
          label="Top tier"
          value={
            stats
              ? (stats.distribution.outstanding ?? 0) + (stats.distribution.excellent ?? 0)
              : "—"
          }
          sub="excellent + outstanding"
        />
      </section>

      {/* Histogram + Criteria averages */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="p-5 bg-surface-elevated border border-border rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-4">Score distribution</h2>
          {stats ? (
            <div className="space-y-2">
              {CONFIDENCE_ORDER.map((level) => {
                const count = stats.distribution[level] ?? 0;
                const pct = (count / histogramMax) * 100;
                return (
                  <button
                    key={level}
                    onClick={() => setFilter(filter === level ? "all" : level)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`uppercase tracking-wide ${filter === level ? "text-white" : "text-white/50 group-hover:text-white"}`}>
                        {level}
                      </span>
                      <span className="text-white/40">{count}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${CONFIDENCE_COLOR[level]?.split(" ")[0] || "bg-white/20"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/40">Loading…</p>
          )}
        </div>

        <div className="p-5 bg-surface-elevated border border-border rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-4">Criteria averages</h2>
          {stats && Object.keys(stats.criteria_averages).length > 0 ? (
            <div className="space-y-2">
              {[...BASE_CRITERIA, ...BONUS_CRITERIA].map(([key, max]) => {
                const avg = stats.criteria_averages[key];
                if (avg === undefined) return null;
                const pct = (avg / max) * 100;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize text-white/60">{pretty(key)}</span>
                      <span className="text-white/40 font-mono">
                        {avg.toFixed(1)}/{max}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400/70"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/40">No scored videos yet.</p>
          )}
        </div>
      </section>

      {/* Cache TTL distribution */}
      {stats && Object.keys(stats.cache_distribution).length > 0 && (
        <section className="mb-8 p-5 bg-surface-elevated border border-border rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-3">Cache TTL distribution</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.cache_distribution)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([ttl, count]) => (
                <div
                  key={ttl}
                  className="px-3 py-1.5 bg-white/5 border border-border rounded-lg text-xs"
                >
                  <span className="text-white/40">{ttl === "0d" ? "no cache" : ttl}</span>
                  <span className="ml-2 text-white font-semibold">{count}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Filter pill */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-white/40 uppercase tracking-wide">Filter</span>
        {["all", ...CONFIDENCE_ORDER].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              filter === level
                ? "bg-accent-muted text-accent-light"
                : "bg-white/5 text-white/40 hover:text-white"
            }`}
          >
            {level}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-muted border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* Video table */}
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">YouTube ID</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Base</th>
              <th className="px-4 py-3">Bonus</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Cache</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  No scored videos.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{row.youtube_id}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.total_score}</td>
                    <td className="px-4 py-3 text-white/60">{row.base_score}/100</td>
                    <td className="px-4 py-3 text-white/60">{row.bonus_total}/70</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_COLOR[row.confidence_level] || ""}`}>
                        {row.confidence_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50">
                      {row.cache_ttl_days === 0 ? "—" : `${row.cache_ttl_days}d`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        className="text-xs text-accent-light hover:text-white"
                      >
                        {expanded === row.id ? "Hide" : "Breakdown"}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="bg-surface/40">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Base (max 100)</div>
                            {BASE_CRITERIA.map(([k, max]) => (
                              <CriterionBar
                                key={k}
                                label={pretty(k)}
                                value={row.base_scores[k] ?? 0}
                                max={max}
                              />
                            ))}
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Bonus (max 70)</div>
                            {BONUS_CRITERIA.map(([k, max]) => (
                              <CriterionBar
                                key={k}
                                label={pretty(k)}
                                value={row.bonus_scores[k] ?? 0}
                                max={max}
                              />
                            ))}
                          </div>
                        </div>
                        {row.reasoning && (
                          <p className="mt-4 text-sm text-white/55 italic border-l-2 border-accent-light/30 pl-3">
                            {row.reasoning}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  suffix,
}: {
  label: string;
  value: number | string;
  sub?: string;
  suffix?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-border bg-surface-elevated">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">
        {value}
        {suffix && <span className="text-sm text-white/40 font-normal ml-1">{suffix}</span>}
      </div>
      {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function CriterionBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="capitalize text-white/55">{label}</span>
        <span className="text-white/40 font-mono">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400/70"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
