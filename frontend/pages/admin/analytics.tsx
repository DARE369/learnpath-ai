import React, { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import axios from "axios";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertCircle,
  RefreshCw,
  Activity,
  BarChart2,
} from "lucide-react";
import MetricCard from "../../components/Analytics/MetricCard";
import RevenueChart from "../../components/Analytics/RevenueChart";
import CohortTable from "../../components/Analytics/CohortTable";
import { useAuth } from "../../hooks/useAuth";

interface PlatformMetrics {
  total_users: number;
  new_users_this_month: number;
  active_users_30d: number;
  active_users_7d: number;
  active_users_today: number;
  total_videos_watched: number;
  total_hours_learned: number;
  avg_user_retention_pct: number;
}

interface RevenueMetrics {
  monthly_recurring_revenue: number;
  total_revenue_all_time: number;
  arpu: number;
  free_users_count: number;
  pro_users_count: number;
  premium_users_count: number;
  revenue_by_plan: Record<string, number>;
  revenue_trend_last_6_months: Array<{ month: string; revenue: number }>;
}

interface ChurnMetrics {
  churn_rate_monthly: number;
  users_churned_this_month: number;
  at_risk_users_count: number;
}

interface EngagementMetrics {
  avg_session_length_minutes: number;
  sessions_per_user_30d: number;
  video_completion_rate_pct: number;
}

interface CohortData {
  cohorts: Array<{ signup_month: string; total_users: number; still_active: number; retention_percentage: number }>;
}

interface FunnelMetrics {
  funnel_steps: Record<string, number>;
  conversion_rates: Record<string, number>;
}

interface UserAnalytics {
  videos_watched_total: number;
  hours_learned_total: number;
  questions_answered: number;
  accuracy_percentage: number;
  learning_velocity: number;
  days_active: number;
}

type Section = "overview" | "revenue" | "users" | "personal";

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-white/50 hover:text-white hover:bg-surface-hover"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { accessToken } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const [platform, setPlatform] = useState<PlatformMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueMetrics | null>(null);
  const [churn, setChurn] = useState<ChurnMetrics | null>(null);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [cohorts, setCohorts] = useState<CohortData | null>(null);
  const [funnel, setFunnel] = useState<FunnelMetrics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);

  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [p, r, c, e, co, f, u] = await Promise.allSettled([
        axios.get("/api/analytics/platform", { headers }),
        axios.get("/api/analytics/revenue", { headers }),
        axios.get("/api/analytics/churn", { headers }),
        axios.get("/api/analytics/engagement", { headers }),
        axios.get("/api/analytics/cohorts", { headers }),
        axios.get("/api/analytics/funnel", { headers }),
        axios.get("/api/analytics/user", { headers }),
      ]);
      if (p.status === "fulfilled") setPlatform(p.value.data);
      if (r.status === "fulfilled") setRevenue(r.value.data);
      if (c.status === "fulfilled") setChurn(c.value.data);
      if (e.status === "fulfilled") setEngagement(e.value.data);
      if (co.status === "fulfilled") setCohorts(co.value.data);
      if (f.status === "fulfilled") setFunnel(f.value.data);
      if (u.status === "fulfilled") setUserAnalytics(u.value.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  function fmtN(n: number | undefined): string {
    if (n == null) return "—";
    return n.toLocaleString();
  }
  function fmtP(n: number | undefined): string {
    if (n == null) return "—";
    return `${n.toFixed(1)}%`;
  }
  function fmtMoney(n: number | undefined): string {
    if (n == null) return "—";
    return `NGN ${n.toLocaleString()}`;
  }

  return (
    <>
      <Head>
        <title>Analytics · Admin · LearnPath AI</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Analytics</h1>
            {lastUpdated && <p className="text-xs text-white/30 mt-0.5">Last updated {lastUpdated}</p>}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-border text-white/60 text-sm hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto">
          {(["overview", "revenue", "users", "personal"] as Section[]).map((s) => (
            <SectionTab
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              active={section === s}
              onClick={() => setSection(s)}
            />
          ))}
        </div>

        {/* Overview */}
        {section === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Users"
                value={platform?.total_users ?? "—"}
                icon={<Users size={16} />}
              />
              <MetricCard
                label="Active (30d)"
                value={platform?.active_users_30d ?? "—"}
                icon={<Activity size={16} />}
              />
              <MetricCard
                label="MRR"
                value={revenue ? `NGN ${revenue.monthly_recurring_revenue.toLocaleString()}` : "—"}
                icon={<DollarSign size={16} />}
              />
              <MetricCard
                label="Monthly Churn"
                value={churn ? `${churn.churn_rate_monthly.toFixed(1)}%` : "—"}
                icon={<TrendingDown size={16} />}
              />
            </div>

            {/* Revenue chart */}
            <RevenueChart data={revenue?.revenue_trend_last_6_months ?? []} />

            {/* Cohorts */}
            <CohortTable cohorts={cohorts?.cohorts ?? []} />

            {/* Engagement */}
            {engagement && (
              <div className="bg-surface-elevated border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Engagement</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="Avg session length" value={`${engagement.avg_session_length_minutes.toFixed(1)} min`} />
                  <Stat label="Sessions / user (30d)" value={engagement.sessions_per_user_30d.toFixed(1)} />
                  <Stat label="Video completion rate" value={fmtP(engagement.video_completion_rate_pct)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revenue */}
        {section === "revenue" && revenue && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard label="MRR" value={fmtMoney(revenue.monthly_recurring_revenue)} icon={<DollarSign size={16} />} />
              <MetricCard label="All-time revenue" value={fmtMoney(revenue.total_revenue_all_time)} icon={<TrendingUp size={16} />} />
              <MetricCard label="ARPU" value={fmtMoney(revenue.arpu)} icon={<Target size={16} />} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Stat label="Free users" value={fmtN(revenue.free_users_count)} />
              <Stat label="Pro users" value={fmtN(revenue.pro_users_count)} />
              <Stat label="Premium users" value={fmtN(revenue.premium_users_count)} />
            </div>

            <RevenueChart data={revenue.revenue_trend_last_6_months} />
          </div>
        )}

        {/* Users */}
        {section === "users" && (
          <div className="space-y-6">
            {platform && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Stat label="Total users" value={fmtN(platform.total_users)} />
                <Stat label="New this month" value={fmtN(platform.new_users_this_month)} />
                <Stat label="Active (30d)" value={fmtN(platform.active_users_30d)} />
                <Stat label="Active (7d)" value={fmtN(platform.active_users_7d)} />
                <Stat label="Active today" value={fmtN(platform.active_users_today)} />
                <Stat label="Avg retention" value={fmtP(platform.avg_user_retention_pct)} />
              </div>
            )}

            {churn && (
              <div className="bg-surface-elevated border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Churn</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="Monthly churn rate" value={fmtP(churn.churn_rate_monthly)} />
                  <Stat label="Churned this month" value={fmtN(churn.users_churned_this_month)} />
                  <Stat label="At-risk users" value={fmtN(churn.at_risk_users_count)} />
                </div>
              </div>
            )}

            <CohortTable cohorts={cohorts?.cohorts ?? []} />

            {funnel && (
              <div className="bg-surface-elevated border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-white mb-4">Conversion Funnel</h3>
                <div className="space-y-3">
                  {Object.entries(funnel.funnel_steps).map(([step, count]) => (
                    <div key={step} className="flex items-center justify-between">
                      <span className="text-sm text-white/60 capitalize">{step.replace(/_/g, " ")}</span>
                      <span className="text-sm font-semibold text-white tabular-nums">{fmtN(count)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/40 pt-3 space-y-2">
                    {Object.entries(funnel.conversion_rates).map(([step, rate]) => (
                      <div key={step} className="flex items-center justify-between">
                        <span className="text-xs text-white/40 capitalize">{step.replace(/_/g, " ")}</span>
                        <span className="text-xs font-medium text-accent-light">{(rate as number).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal */}
        {section === "personal" && userAnalytics && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Total videos" value={fmtN(userAnalytics.videos_watched_total)} />
            <Stat label="Total hours" value={`${userAnalytics.hours_learned_total.toFixed(1)}h`} />
            <Stat label="Questions answered" value={fmtN(userAnalytics.questions_answered)} />
            <Stat label="Accuracy" value={fmtP(userAnalytics.accuracy_percentage)} />
            <Stat label="Learning velocity" value={`${userAnalytics.learning_velocity.toFixed(2)} vid/day`} />
            <Stat label="Days active (90d)" value={fmtN(userAnalytics.days_active)} />
          </div>
        )}
      </div>
    </>
  );
}
