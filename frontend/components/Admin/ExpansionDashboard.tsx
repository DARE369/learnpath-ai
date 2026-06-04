import React, { useCallback, useEffect, useState } from "react";
import { config } from "../../env.config";

interface RunRow {
  id: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  distinct_queries_scanned: number;
  aliases_created: number;
  popular_topics_count: number;
  keywords_extracted: number;
  topics_expanded: number;
  expansion_cost_ngn: number;
  branching_cost_ngn: number;
  skipped_budget: boolean;
  errors: string[];
  status: string;
}

interface PopularRow {
  query: string;
  count: number;
}

interface AliasRow {
  id: string;
  alias_query: string;
  canonical_query: string;
  similarity_score: number;
  created_at: string | null;
}

interface BudgetSnapshot {
  budget_ngn: number;
  spent_ngn: number;
  remaining_ngn: number;
}

interface TodayCosts {
  expansion?: BudgetSnapshot;
  branching?: BudgetSnapshot;
}

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-300",
  partial: "bg-amber-500/20 text-amber-300",
  failed: "bg-rose-500/20 text-rose-300",
  running: "bg-indigo-500/20 text-indigo-300",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExpansionDashboard() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [popular, setPopular] = useState<PopularRow[]>([]);
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [today, setToday] = useState<TodayCosts | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, popRes, aliasRes, statsRes] = await Promise.all([
        fetch(`${config.apiUrl}/api/expansion/runs?limit=10`),
        fetch(`${config.apiUrl}/api/expansion/popular`),
        fetch(`${config.apiUrl}/api/expansion/aliases?limit=50`),
        fetch(`${config.apiUrl}/api/expansion/stats`),
      ]);
      for (const r of [runsRes, popRes, aliasRes, statsRes]) {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
      }
      const runsJson = await runsRes.json();
      const popJson = await popRes.json();
      const aliasJson = await aliasRes.json();
      const statsJson = await statsRes.json();
      setRuns(runsJson.items || []);
      setPopular(popJson.items || []);
      setAliases(aliasJson.items || []);
      setToday(statsJson.today_costs || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${config.apiUrl}/api/expansion/run-now`, { method: "POST" });
      if (!res.ok) throw new Error(`Run failed: ${res.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Expansion Dashboard</h1>
          <p className="text-sm text-white/50 mt-1">
            Nightly self-building: dedup, keyword index, popular-topic auto-expansion.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running || loading}
          className="px-4 py-2 rounded-lg bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Running…" : "Run now"}
        </button>
      </header>

      {error && (
        <div className="mb-4 p-3 bg-error-muted border border-error/30 rounded-lg text-sm text-error">
          {error}
        </div>
      )}

      {/* Today's costs */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <BudgetCard label="Expansion budget (today)" snapshot={today?.expansion} />
        <BudgetCard label="Branching budget (today)" snapshot={today?.branching} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Popular topics */}
        <div className="p-5 bg-surface-elevated border border-border rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-3">
            Popular topics (last 30 days)
          </h2>
          {popular.length === 0 ? (
            <p className="text-sm text-white/40">None — fewer than 10 searches per topic.</p>
          ) : (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto">
              {popular.map((p) => (
                <li
                  key={p.query}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-white/70 truncate mr-2">{p.query}</span>
                  <span className="text-white/40 font-mono text-xs">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aliases */}
        <div className="lg:col-span-2 p-5 bg-surface-elevated border border-border rounded-2xl">
          <h2 className="text-sm font-semibold text-white mb-1">
            Proposed dedup aliases
          </h2>
          <p className="text-xs text-white/40 mb-3">
            Informational — SearchService doesn&apos;t consult these yet.
          </p>
          {aliases.length === 0 ? (
            <p className="text-sm text-white/40">No aliases yet — run the job to generate them.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="text-left pb-2 pr-3">Alias</th>
                    <th className="text-left pb-2 pr-3">Canonical</th>
                    <th className="text-right pb-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.slice(0, 8).map((a) => (
                    <tr key={a.id} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 text-white/70 font-mono truncate max-w-[10rem]">
                        {a.alias_query}
                      </td>
                      <td className="py-1.5 pr-3 text-white font-mono truncate max-w-[10rem]">
                        {a.canonical_query}
                      </td>
                      <td className="py-1.5 text-right text-white/50">
                        {(a.similarity_score ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {aliases.length > 8 && (
                <p className="mt-2 text-xs text-white/30">
                  +{aliases.length - 8} more aliases…
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Run history */}
      <h2 className="text-sm font-semibold text-white mb-3">
        Recent nightly runs
      </h2>
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Aliases</th>
              <th className="px-4 py-3">Keywords</th>
              <th className="px-4 py-3">Expansions</th>
              <th className="px-4 py-3">Cost (₦)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  Loading…
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  No runs yet. Click <strong>Run now</strong> to trigger one manually.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.started_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || "bg-white/10 text-white/60"}`}
                    >
                      {r.status}
                    </span>
                    {r.skipped_budget && (
                      <span className="ml-2 text-xs text-warning">budget capped</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {r.duration_seconds ? `${r.duration_seconds.toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70">{r.aliases_created}</td>
                  <td className="px-4 py-3 text-white/70">{r.keywords_extracted}</td>
                  <td className="px-4 py-3 text-white/70">{r.topics_expanded}</td>
                  <td className="px-4 py-3 text-white/60 font-mono">
                    {(r.expansion_cost_ngn + r.branching_cost_ngn).toFixed(2)}
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

function BudgetCard({
  label,
  snapshot,
}: {
  label: string;
  snapshot?: BudgetSnapshot;
}) {
  const pct = snapshot ? (snapshot.spent_ngn / Math.max(1e-6, snapshot.budget_ngn)) * 100 : 0;
  return (
    <div className="p-4 rounded-xl border border-border bg-surface-elevated">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-white/40">{label}</span>
        <span className="text-xs text-white/40 font-mono">
          {snapshot
            ? `₦${snapshot.spent_ngn.toFixed(2)} / ₦${snapshot.budget_ngn.toFixed(2)}`
            : "—"}
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400/70"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
