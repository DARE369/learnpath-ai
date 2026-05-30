import React, { useCallback, useEffect, useMemo, useState } from "react";
import { config } from "../../env.config";

interface BlacklistRow {
  id: string;
  youtube_id: string;
  blacklist_type: "soft" | "hard";
  reason: string | null;
  last_score: number | null;
  blacklist_date: string;
  retry_date: string | null;
  expired: boolean;
  feedback_avg_rating: number | null;
  feedback_count: number;
}

interface Stats {
  total_active: number;
  soft: number;
  hard: number;
  pending_re_evaluation: number;
  feedback_count: number;
  feedback_avg_rating: number | null;
}

type SortKey = "blacklist_date" | "last_score" | "blacklist_type";
type FilterType = "all" | "soft" | "hard";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function BlacklistDashboard() {
  const [items, setItems] = useState<BlacklistRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("blacklist_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filterType === "all" ? "" : `?blacklist_type=${filterType}`;
      const [listRes, statsRes] = await Promise.all([
        fetch(`${config.apiUrl}/api/blacklist${qs}`),
        fetch(`${config.apiUrl}/api/blacklist/stats`),
      ]);
      if (!listRes.ok) throw new Error(`List failed: ${listRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats failed: ${statsRes.status}`);
      const listJson = await listRes.json();
      const statsJson = await statsRes.json();
      setItems(listJson.items || []);
      setStats(statsJson);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load blacklist");
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "blacklist_date") {
        av = new Date(a.blacklist_date).getTime();
        bv = new Date(b.blacklist_date).getTime();
      } else if (sortKey === "last_score") {
        av = a.last_score ?? -1;
        bv = b.last_score ?? -1;
      } else {
        av = a.blacklist_type;
        bv = b.blacklist_type;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [items, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function lift(youtubeId: string) {
    setBusyId(youtubeId);
    try {
      const res = await fetch(`${config.apiUrl}/api/blacklist/${youtubeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Lift failed: ${res.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lift failed");
    } finally {
      setBusyId(null);
    }
  }

  async function convert(youtubeId: string, newType: "soft" | "hard") {
    setBusyId(youtubeId);
    try {
      const res = await fetch(`${config.apiUrl}/api/blacklist/${youtubeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blacklist_type: newType }),
      });
      if (!res.ok) throw new Error(`Convert failed: ${res.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reEvaluate() {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/blacklist/re-evaluate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Re-evaluate failed: ${res.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Re-evaluate failed");
    } finally {
      setLoading(false);
    }
  }

  async function backfillAuto() {
    setLoading(true);
    try {
      const res = await fetch(
        `${config.apiUrl}/api/blacklist/auto-blacklist-low-scores`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Backfill failed: ${res.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Blacklist Dashboard</h1>
        <p className="text-sm text-white/50">
          Soft and hard blacklisted videos. Soft entries auto-expire after 90 days for re-evaluation.
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats ? (
          <>
            <StatCard label="Total" value={stats.total_active} />
            <StatCard label="Soft" value={stats.soft} />
            <StatCard label="Hard" value={stats.hard} />
            <StatCard label="Pending re-eval" value={stats.pending_re_evaluation} accent />
            <StatCard
              label="Avg feedback"
              value={
                stats.feedback_avg_rating !== null
                  ? `${stats.feedback_avg_rating.toFixed(1)}★`
                  : "—"
              }
              sub={`${stats.feedback_count} responses`}
            />
          </>
        ) : (
          <div className="col-span-5 text-sm text-white/40">Loading stats…</div>
        )}
      </section>

      {/* Controls */}
      <section className="mb-6 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase text-white/40 tracking-wide">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="all">All</option>
            <option value="soft">Soft</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reEvaluate}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-accent-muted text-accent-light text-sm font-medium hover:bg-accent-muted/80 disabled:opacity-50"
          >
            Re-evaluate expired
          </button>
          <button
            type="button"
            onClick={backfillAuto}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-white text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
          >
            Auto-blacklist low scores
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-4 p-3 bg-error-muted border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">YouTube ID</th>
              <SortableTh
                label="Type"
                active={sortKey === "blacklist_type"}
                dir={sortDir}
                onClick={() => toggleSort("blacklist_type")}
              />
              <SortableTh
                label="Score"
                active={sortKey === "last_score"}
                dir={sortDir}
                onClick={() => toggleSort("last_score")}
              />
              <th className="px-4 py-3">Reason</th>
              <SortableTh
                label="Blacklisted"
                active={sortKey === "blacklist_date"}
                dir={sortDir}
                onClick={() => toggleSort("blacklist_date")}
              />
              <th className="px-4 py-3">Retry</th>
              <th className="px-4 py-3">Feedback</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-white/40">
                  Loading…
                </td>
              </tr>
            ) : sortedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-white/40">
                  No blacklisted videos.
                </td>
              </tr>
            ) : (
              sortedItems.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{row.youtube_id}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={row.blacklist_type} />
                  </td>
                  <td className="px-4 py-3 text-white/70">{row.last_score ?? "—"}</td>
                  <td className="px-4 py-3 text-white/55 max-w-xs truncate" title={row.reason || ""}>
                    {row.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-white/50">{formatDate(row.blacklist_date)}</td>
                  <td className="px-4 py-3">
                    {row.retry_date ? (
                      <span className={row.expired ? "text-warning" : "text-white/50"}>
                        {formatDate(row.retry_date)}
                        {row.expired && " (expired)"}
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {row.feedback_count > 0
                      ? `${row.feedback_avg_rating?.toFixed(1) ?? "—"}★ (${row.feedback_count})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {row.blacklist_type === "soft" && (
                        <button
                          type="button"
                          disabled={busyId === row.youtube_id}
                          onClick={() => convert(row.youtube_id, "hard")}
                          className="px-2 py-1 rounded text-xs bg-error-muted text-error hover:bg-error-muted/80 disabled:opacity-50"
                          title="Convert to permanent hard blacklist"
                        >
                          Make permanent
                        </button>
                      )}
                      {row.blacklist_type === "hard" && (
                        <button
                          type="button"
                          disabled={busyId === row.youtube_id}
                          onClick={() => convert(row.youtube_id, "soft")}
                          className="px-2 py-1 rounded text-xs bg-warning-muted text-warning hover:bg-warning-muted/80 disabled:opacity-50"
                          title="Convert to soft (will be re-evaluated)"
                        >
                          Soften
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === row.youtube_id}
                        onClick={() => lift(row.youtube_id)}
                        className="px-2 py-1 rounded text-xs bg-success-muted text-success hover:bg-success-muted/80 disabled:opacity-50"
                      >
                        Lift
                      </button>
                    </div>
                  </td>
                </tr>
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
  accent = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? "border-warning/30 bg-warning-muted" : "border-border bg-surface-elevated"}`}>
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function TypeBadge({ type }: { type: "soft" | "hard" }) {
  const cls =
    type === "hard"
      ? "bg-error-muted text-error"
      : "bg-accent-muted text-accent-light";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {type}
    </span>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      className="px-4 py-3 cursor-pointer select-none hover:text-white"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-white/60">{dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}
