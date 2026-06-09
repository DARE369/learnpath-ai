import React, { useEffect, useState } from "react";
import Head from "next/head";
import { Users, DollarSign, TrendingUp, Database, Cpu, Activity } from "lucide-react";
import { Card, StatTile, SectionHeader, Skeleton, ProgressBar } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";

interface Overview {
  users_by_role?: Record<string, number>;
  total_users?: number;
  revenue?: { mrr?: number; arpu?: number; [k: string]: unknown };
  activation?: { steps?: { step: string; users: number; pct_of_signups: number }[] };
  health?: Record<string, unknown>;
  ai_budgets?: Record<string, { budget_ngn: number; spent_ngn: number; remaining_ngn: number }>;
  cache?: { hit_rate_percent?: number; topic_cache_size?: number };
  path_library?: { stored_paths: number; served_from_library: number; est_generations_saved: number };
}

function prettyStep(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlatformDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/analytics/overview", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("Could not load platform metrics."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const mrr = Number(data?.revenue?.mrr ?? 0);
  const library = data?.path_library;

  return (
    <>
      <Head><title>Platform — Admin — LearnPath AI</title></Head>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform overview</h1>
          <p className="mt-1 text-sm text-white/40">Global health, revenue, activation, and AI/token savings.</p>
        </div>

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <Card><p className="text-sm text-error">{error}</p></Card>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={<Users className="h-5 w-5" />} label="Total users" value={data?.total_users ?? 0} color="accent" />
              <StatTile icon={<DollarSign className="h-5 w-5" />} label="MRR (NGN)" value={`₦${mrr.toLocaleString()}`} color="success" />
              <StatTile icon={<Database className="h-5 w-5" />} label="Cached paths" value={library?.stored_paths ?? 0} color="info" />
              <StatTile icon={<Cpu className="h-5 w-5" />} label="Generations saved" value={library?.served_from_library ?? 0} color="warning" />
            </div>

            {/* Users by role */}
            <Card>
              <SectionHeader title="Users by role" />
              <div className="flex flex-wrap gap-3">
                {Object.entries(data?.users_by_role ?? {}).map(([role, count]) => (
                  <div key={role} className="rounded-xl border border-border bg-surface-elevated px-4 py-2">
                    <p className="text-lg font-bold text-white tabular-nums">{count}</p>
                    <p className="text-xs capitalize text-white/40">{role.replace("_", " ")}</p>
                  </div>
                ))}
                {Object.keys(data?.users_by_role ?? {}).length === 0 && (
                  <p className="text-sm text-white/40">No user data.</p>
                )}
              </div>
            </Card>

            {/* Activation funnel */}
            <Card>
              <SectionHeader title="Activation funnel" subtitle="Last 30 days' signups" />
              <div className="space-y-3">
                {(data?.activation?.steps ?? []).map((s) => (
                  <div key={s.step}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-white/70">{prettyStep(s.step)}</span>
                      <span className="text-white/50 tabular-nums">{s.users} · {s.pct_of_signups}%</span>
                    </div>
                    <ProgressBar value={s.pct_of_signups} />
                  </div>
                ))}
                {(data?.activation?.steps ?? []).length === 0 && (
                  <p className="text-sm text-white/40">No activation data yet.</p>
                )}
              </div>
            </Card>

            {/* AI cost fences + cache */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="AI budgets (today)" subtitle="Per-feature NGN spend vs cap" />
                <div className="space-y-2.5">
                  {Object.entries(data?.ai_budgets ?? {}).map(([feature, b]) => (
                    <div key={feature}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-white/60">{feature.replace(/_/g, " ")}</span>
                        <span className="text-white/40 tabular-nums">₦{b.spent_ngn} / ₦{b.budget_ngn}</span>
                      </div>
                      <ProgressBar value={b.budget_ngn ? (b.spent_ngn / b.budget_ngn) * 100 : 0} color="warning" size="sm" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionHeader title="Cache & savings" />
                <div className="space-y-3 text-sm">
                  <Row label="Cache hit rate" value={`${data?.cache?.hit_rate_percent ?? 0}%`} icon={<Activity className="h-4 w-4 text-success" />} />
                  <Row label="Topics in memory" value={String(data?.cache?.topic_cache_size ?? 0)} icon={<Database className="h-4 w-4 text-info" />} />
                  <Row label="Stored paths (library)" value={String(library?.stored_paths ?? 0)} icon={<Database className="h-4 w-4 text-white/50" />} />
                  <Row label="Est. generations saved" value={String(library?.est_generations_saved ?? 0)} icon={<TrendingUp className="h-4 w-4 text-warning" />} />
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-white/60">{icon}{label}</span>
      <span className="font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}
