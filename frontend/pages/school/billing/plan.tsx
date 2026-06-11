import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, SectionHeader } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";
import {
  BillingPlan, PlanComparisonModal, UpgradeModal,
} from "../../../components/School/BillingModals";

// ── Types ──────────────────────────────────────────────────────────────────

interface UsageStat { used: number; limit: number; pct: number }
interface ForecastWarning {
  metric: string; current: number; projected_90d: number;
  limit: number; days_until_limit: number; severity: string;
}
interface Overview {
  subscription: {
    subscription_id: string; plan_name: string; plan_slug: string;
    monthly_price: number; billing_cycle: string; status: string;
    auto_renew: boolean; renews_at: string | null; days_until_renewal: number;
    billing_contact: string | null;
  };
  usage: {
    teachers: UsageStat; students: UsageStat; classes: UsageStat;
    storage_gb: UsageStat; api_calls: UsageStat;
  };
  forecast: ForecastWarning[];
  recommended_plan: (BillingPlan & { additional_monthly: number }) | null;
  recent_invoices: { invoice_id: string; invoice_number: string; invoice_date: string; total: number; status: string }[];
}

// ── Usage bar ──────────────────────────────────────────────────────────────

function UsageBar({ label, used, limit, pct }: { label: string; used: number | string; limit: number | string; pct: number }) {
  const color = pct >= 90 ? "bg-error" : pct >= 75 ? "bg-amber-400" : "bg-accent";
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-sm text-white/60">{label}</div>
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
      <div className="w-28 text-right text-xs tabular-nums text-white/50">{used} / {limit}</div>
      <div className={`w-10 text-right text-xs font-semibold tabular-nums ${pct >= 90 ? "text-error" : pct >= 75 ? "text-amber-400" : "text-white/60"}`}>{pct}%</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BillingPlanPage() {
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [ov, pl] = await Promise.all([
        fetch(`/api/school-admin/${schoolId}/billing/overview`, { headers: auth }).then((r) => r.ok ? r.json() : null),
        fetch(`/api/school-admin/${schoolId}/billing/plan-comparison`, { headers: auth }).then((r) => r.ok ? r.json() : null),
      ]);
      if (ov) setData(ov);
      if (pl) setPlans(pl.plans ?? []);
    } finally { setLoading(false); }
  }, [schoolId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  async function doUpgrade(slug: string, cycle: string) {
    if (!schoolId) return;
    await fetch(`/api/school-admin/${schoolId}/billing/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan_slug: slug, billing_cycle: cycle }),
    });
    setUpgradePlan(null);
    load();
  }

  function openUpgrade(slug: string) {
    const plan = plans.find((p) => p.plan_slug === slug);
    if (plan) setUpgradePlan(plan);
  }

  const sub = data?.subscription;
  const usage = data?.usage;

  return (
    <SchoolLayout>
      <Head><title>Billing — LearnPath for Schools</title></Head>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
            <p className="mt-1 text-sm text-white/40">Manage your subscription, usage, and invoices.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowComparison(true)}>Compare plans</Button>
            <Button size="sm" href="/school/billing/invoices" rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}>All invoices</Button>
          </div>
        </div>

        {loading ? <Skeleton className="h-96 w-full" /> : !data ? (
          <p className="text-white/40">Couldn&apos;t load billing data.</p>
        ) : (
          <div className="space-y-6">
            {/* Current plan */}
            <Card padding="md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">{sub?.plan_name} Plan</h2>
                    <Badge tone={sub?.status === "active" ? "success" : "neutral"}>{sub?.status}</Badge>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">${sub?.monthly_price}<span className="text-sm font-normal text-white/40">/month</span></p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-white/50">
                    <span>Cycle: {sub?.billing_cycle}</span>
                    {sub?.renews_at && <span>Renews: {new Date(sub.renews_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                    {(sub?.days_until_renewal ?? 0) > 0 && <span>{sub?.days_until_renewal} days remaining</span>}
                    <span>Auto-renew: {sub?.auto_renew ? "on" : "off"}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowComparison(true)}>Upgrade plan</Button>
              </div>
            </Card>

            {/* Usage */}
            {usage && (
              <Card padding="md">
                <SectionHeader title="Usage this billing period" />
                <div className="mt-4 space-y-3">
                  <UsageBar label="Teachers" used={usage.teachers.used} limit={usage.teachers.limit} pct={usage.teachers.pct} />
                  <UsageBar label="Students" used={usage.students.used} limit={usage.students.limit} pct={usage.students.pct} />
                  <UsageBar label="Classes" used={usage.classes.used} limit={usage.classes.limit} pct={usage.classes.pct} />
                  <UsageBar label="Storage" used={`${usage.storage_gb.used} GB`} limit={`${usage.storage_gb.limit} GB`} pct={usage.storage_gb.pct} />
                  <UsageBar label="API calls" used={usage.api_calls.used.toLocaleString()} limit={usage.api_calls.limit.toLocaleString()} pct={usage.api_calls.pct} />
                </div>
              </Card>
            )}

            {/* Forecast warnings */}
            {data.forecast.length > 0 && (
              <Card padding="md">
                <SectionHeader title="90-day forecast" />
                <ul className="mt-3 space-y-2">
                  {data.forecast.map((w) => (
                    <li key={w.metric} className={`flex items-start gap-2 rounded-lg p-3 text-sm ${w.severity === "critical" ? "bg-error/10 text-error" : "bg-amber-500/10 text-amber-300"}`}>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <strong className="capitalize">{w.metric}</strong>: {w.current} now → ~{w.projected_90d} in 90 days
                        {w.days_until_limit < 9999 && ` · limit in ~${w.days_until_limit} days`}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Recommended upgrade */}
            {data.recommended_plan && (
              <Card padding="md" className="border-accent/30">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-accent">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-semibold">Recommended: {data.recommended_plan.plan_name}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">{data.recommended_plan.description}</p>
                    <p className="mt-1 text-sm text-white">${data.recommended_plan.monthly_price}/mo <span className="text-white/40">(+${data.recommended_plan.additional_monthly}/mo from current)</span></p>
                  </div>
                  <Button size="sm" onClick={() => openUpgrade(data.recommended_plan!.plan_slug)}>Upgrade now</Button>
                </div>
              </Card>
            )}

            {/* Recent invoices */}
            {data.recent_invoices.length > 0 && (
              <Card padding="none">
                <div className="px-4 pt-4"><SectionHeader title="Recent invoices" /></div>
                <ul className="divide-y divide-border">
                  {data.recent_invoices.map((inv) => (
                    <li key={inv.invoice_id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-white">{inv.invoice_number}</p>
                        <p className="text-xs text-white/40">{new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums text-white">${inv.total.toFixed(2)}</span>
                        <Badge tone={inv.status === "paid" ? "success" : "neutral"}>{inv.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-3">
                  <Link href="/school/billing/invoices" className="text-sm text-accent-light hover:text-white">View all invoices →</Link>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {showComparison && (
        <PlanComparisonModal plans={plans} currentSlug={data?.subscription.plan_slug ?? "pro"}
          onUpgrade={openUpgrade} onClose={() => setShowComparison(false)} />
      )}
      {upgradePlan && data && (
        <UpgradeModal plan={upgradePlan} currentMonthly={data.subscription.monthly_price}
          renewsAt={data.subscription.renews_at}
          onConfirm={doUpgrade} onClose={() => setUpgradePlan(null)} />
      )}
    </SchoolLayout>
  );
}
