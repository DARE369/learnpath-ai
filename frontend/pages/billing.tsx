import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import FeatureMatrix from "../components/Billing/FeatureMatrix";
import {
  CreditCard,
  Check,
  AlertCircle,
  Calendar,
  TrendingUp,
  Zap,
  Shield,
  Loader2,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const NAIRA = "₦";
const UNLIMITED = 999999;

interface PlanUsage {
  videos: number;
  hours: number;
  questions: number;
}

interface CurrentPlan {
  subscription_id: string | null;
  plan_type: string;
  plan_name: string;
  billing_cycle: string;
  renewal_date: string | null;
  price_paid: number;
  currency: string;
  status: string;
  auto_renew: boolean;
  pending_plan_type: string | null;
  features: string[];
  limits: {
    videos_per_month: number;
    hours_per_month: number;
    questions_per_day: number;
    concepts_per_topic: number;
  };
  usage: { videos_watched: number; hours_learned: number; questions_today: number };
  usage_percentage: PlanUsage;
}

interface CatalogPlan {
  plan_type: string;
  name: string;
  price: number;
  currency: string;
  yearly_price: number;
  videos_per_month: number;
  hours_per_month: number;
  questions_per_day: number;
  features: string[];
}

interface BillingRow {
  id: string;
  date: string | null;
  amount: number;
  plan: string;
  description: string;
  status: string;
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

function fmtLimit(n: number): string {
  return n >= UNLIMITED ? "Unlimited" : String(n);
}

function fmtMoney(n: number): string {
  return `${NAIRA}${n.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function UsageMeter({ label, used, limit, pct }: { label: string; used: number; limit: number; pct: number }) {
  const unlimited = limit >= UNLIMITED;
  const danger = pct >= 90;
  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-sm font-medium text-white">
          {used} <span className="text-white/30">/ {unlimited ? "∞" : limit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${danger ? "bg-error" : "bg-gradient-accent"}`}
          style={{ width: `${unlimited ? 4 : Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [plan, setPlan] = useState<CurrentPlan | null>(null);
  const [catalog, setCatalog] = useState<CatalogPlan[]>([]);
  const [history, setHistory] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const authHeader = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [cur, plans, hist] = await Promise.all([
        axios.get("/api/subscriptions/current", { headers: authHeader }),
        axios.get("/api/subscriptions/plans"),
        axios.get("/api/subscriptions/history", { headers: authHeader }),
      ]);
      setPlan(cur.data);
      setCatalog(plans.data.plans || []);
      setHistory(hist.data.history || []);
    } catch {
      setError("Couldn't load your billing information. Please try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Reconcile a Flutterwave redirect (?status=...&tx_ref=...) on return.
  useEffect(() => {
    if (!router.isReady || !accessToken) return;
    const { status, tx_ref } = router.query as { status?: string; tx_ref?: string };
    if (!status) {
      load();
      return;
    }
    (async () => {
      if (tx_ref && status !== "cancelled") {
        try {
          const res = await axios.get(`/api/payments/verify/${tx_ref}`, { headers: authHeader });
          if (res.data.status === "successful") {
            setBanner({ type: "success", message: "Payment successful — your plan is now active." });
          } else {
            setBanner({ type: "error", message: "Payment is still processing. We'll update your plan once confirmed." });
          }
        } catch {
          setBanner({ type: "error", message: "We couldn't verify your payment. Contact support if you were charged." });
        }
      } else if (status === "cancelled") {
        setBanner({ type: "error", message: "Payment was cancelled. No charge was made." });
      }
      router.replace("/billing", undefined, { shallow: true });
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, accessToken]);

  async function handleSelectPlan(target: CatalogPlan) {
    if (!plan) return;
    const currentRank = PLAN_RANK[plan.plan_type] ?? 0;
    const targetRank = PLAN_RANK[target.plan_type] ?? 0;
    if (targetRank === currentRank) return;

    if (targetRank > currentRank) {
      router.push(`/payment?plan=${target.plan_type}&cycle=${plan.billing_cycle}`);
      return;
    }
    // Downgrade
    setBusy(target.plan_type);
    try {
      await axios.post(
        "/api/subscriptions/downgrade",
        { new_plan: target.plan_type },
        { headers: authHeader },
      );
      setBanner({ type: "success", message: `Downgrade to ${target.name} scheduled for your next renewal.` });
      await load();
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? (err.response?.data as { detail?: string })?.detail : null;
      setBanner({ type: "error", message: detail || "Couldn't schedule the downgrade." });
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!plan || plan.plan_type === "free") return;
    setBusy("cancel");
    try {
      await axios.post("/api/subscriptions/cancel", { reason: "user_requested" }, { headers: authHeader });
      setBanner({ type: "success", message: "Subscription cancelled. Access continues until your period ends." });
      await load();
    } catch {
      setBanner({ type: "error", message: "Couldn't cancel your subscription." });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Billing — LearnPath AI</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Subscription &amp; Billing</h1>
          <p className="text-white/50">Manage your plan, track usage, and view payment history.</p>
        </div>

        {banner && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
              banner.type === "success"
                ? "bg-success-muted border-success/30 text-success"
                : "bg-error-muted border-error/30 text-error"
            }`}
          >
            {banner.type === "success" ? <Check size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
            <p className="text-sm">{banner.message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error-muted p-4 text-error">
            <AlertCircle size={18} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {plan && (
          <div className="space-y-6">
            {/* Current plan */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow-sm">
                    <CreditCard size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{plan.plan_name}</h2>
                    <p className="text-sm text-white/50 capitalize">
                      {plan.status}
                      {plan.plan_type !== "free" && ` · ${plan.billing_cycle}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{fmtMoney(plan.price_paid)}</p>
                  {plan.plan_type !== "free" && (
                    <p className="text-xs text-white/40">per {plan.billing_cycle === "yearly" ? "year" : "month"}</p>
                  )}
                </div>
              </div>

              {plan.plan_type !== "free" && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60 mb-2">
                  <span className="flex items-center gap-2">
                    <Calendar size={15} /> Renews {fmtDate(plan.renewal_date)}
                  </span>
                  {plan.auto_renew ? (
                    <span className="flex items-center gap-2 text-success"><Check size={15} /> Auto-renew on</span>
                  ) : (
                    <span className="flex items-center gap-2 text-warning"><AlertCircle size={15} /> Auto-renew off</span>
                  )}
                  {plan.pending_plan_type && (
                    <span className="flex items-center gap-2 text-warning">
                      <TrendingUp size={15} /> Switching to {plan.pending_plan_type} next renewal
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Usage */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white mb-5">Usage this month</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <UsageMeter label="Videos" used={plan.usage.videos_watched} limit={plan.limits.videos_per_month} pct={plan.usage_percentage.videos} />
                <UsageMeter label="Hours" used={plan.usage.hours_learned} limit={plan.limits.hours_per_month} pct={plan.usage_percentage.hours} />
                <UsageMeter label="Questions today" used={plan.usage.questions_today} limit={plan.limits.questions_per_day} pct={plan.usage_percentage.questions} />
              </div>
            </section>

            {/* Plan comparison */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-5">Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {catalog.map((p) => {
                  const isCurrent = p.plan_type === plan.plan_type;
                  const isUpgrade = (PLAN_RANK[p.plan_type] ?? 0) > (PLAN_RANK[plan.plan_type] ?? 0);
                  return (
                    <div
                      key={p.plan_type}
                      className={`rounded-2xl border p-6 flex flex-col ${
                        isCurrent ? "border-accent bg-accent-muted" : "border-border bg-surface-elevated"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {p.plan_type === "premium" && <Zap size={16} className="text-accent-light" />}
                        <h3 className="text-base font-semibold text-white">{p.name}</h3>
                      </div>
                      <p className="text-2xl font-bold text-white mb-1">
                        {fmtMoney(p.price)}
                        <span className="text-sm font-normal text-white/40">/mo</span>
                      </p>
                      <ul className="space-y-2 my-4 text-sm text-white/60 flex-1">
                        <li className="flex items-center gap-2"><Check size={14} className="text-success" /> {fmtLimit(p.videos_per_month)} videos / month</li>
                        <li className="flex items-center gap-2"><Check size={14} className="text-success" /> {fmtLimit(p.hours_per_month)} hours / month</li>
                        <li className="flex items-center gap-2"><Check size={14} className="text-success" /> {fmtLimit(p.questions_per_day)} questions / day</li>
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 capitalize">
                            <Check size={14} className="text-success" /> {f.replace(/_/g, " ")}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={isCurrent || busy === p.plan_type}
                        onClick={() => handleSelectPlan(p)}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                          isCurrent
                            ? "bg-surface-hover text-white/50"
                            : isUpgrade
                            ? "bg-gradient-accent text-white shadow-glow-sm hover:opacity-90"
                            : "bg-surface-hover text-white hover:bg-surface-hover/70"
                        }`}
                      >
                        {busy === p.plan_type ? "Working…" : isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Downgrade"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Feature comparison matrix */}
            <FeatureMatrix highlightPlan={(plan.plan_type as "free" | "pro" | "premium") || "pro"} />

            {/* Billing history */}
            <section className="bg-surface-elevated border border-border rounded-2xl p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white mb-5">Billing history</h2>
              {history.length === 0 ? (
                <p className="text-sm text-white/40">No billing history yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-white/40 border-b border-border">
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Description</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                        <th className="py-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-3 text-white/70">{fmtDate(row.date)}</td>
                          <td className="py-3 text-white/70">{row.description || row.plan}</td>
                          <td className="py-3 text-right text-white">{fmtMoney(row.amount)}</td>
                          <td className="py-3 text-right">
                            <span className="inline-flex items-center gap-1 text-success text-xs">
                              <Check size={12} /> {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Manage */}
            {plan.plan_type !== "free" && plan.status === "active" && (
              <section className="bg-surface-elevated border border-border rounded-2xl p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Cancel subscription</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Keep access until {fmtDate(plan.renewal_date)}, then move to Free.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={busy === "cancel"}
                    className="px-5 py-2.5 rounded-xl bg-error-muted text-error text-sm font-semibold hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {busy === "cancel" ? "Cancelling…" : "Cancel plan"}
                  </button>
                </div>
              </section>
            )}

            <p className="flex items-center justify-center gap-2 text-xs text-white/30 pt-2">
              <Shield size={13} /> Payments secured by Flutterwave
            </p>
          </div>
        )}
      </div>
    </>
  );
}
