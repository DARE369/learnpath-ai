import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import FeatureMatrix from "../components/Billing/FeatureMatrix";
import UsageAlert from "../components/Billing/UsageAlert";
import type { UsageData } from "../components/Billing/UsageCard";
import { Card } from "../ui-v2/primitives";
import { color, font } from "../ui-v2/tokens";
import { useViewport } from "../ui-v2/useViewport";

const NAIRA = "₦";
const UNLIMITED = 999999;
const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2 };

interface PlanUsage { videos: number; hours: number; questions: number; }
interface CurrentPlan {
  subscription_id: string | null; plan_type: string; plan_name: string; billing_cycle: string; renewal_date: string | null;
  price_paid: number; currency: string; status: string; auto_renew: boolean; pending_plan_type: string | null; features: string[];
  limits: { videos_per_month: number; hours_per_month: number; questions_per_day: number; concepts_per_topic: number };
  usage: { videos_watched: number; hours_learned: number; questions_today: number }; usage_percentage: PlanUsage;
}
interface CatalogPlan { plan_type: string; name: string; price: number; currency: string; yearly_price: number; videos_per_month: number; hours_per_month: number; questions_per_day: number; features: string[]; }
interface BillingRow { id: string; date: string | null; amount: number; plan: string; description: string; status: string; }

function fmtLimit(n: number): string { return n >= UNLIMITED ? "Unlimited" : String(n); }
function fmtMoney(n: number): string { return `${NAIRA}${n.toLocaleString()}`; }
function fmtDate(iso: string | null): string { if (!iso) return "—"; return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }

function toUsageData(plan: CurrentPlan): UsageData {
  const remaining = (used: number, limit: number) => (limit >= UNLIMITED ? UNLIMITED : Math.max(0, limit - used));
  return {
    plan_type: plan.plan_type,
    videos_watched: plan.usage.videos_watched,
    videos_limit: plan.limits.videos_per_month,
    videos_percentage: plan.usage_percentage.videos,
    videos_remaining: remaining(plan.usage.videos_watched, plan.limits.videos_per_month),
    hours_learned: plan.usage.hours_learned,
    hours_limit: plan.limits.hours_per_month,
    hours_percentage: plan.usage_percentage.hours,
    hours_remaining: remaining(plan.usage.hours_learned, plan.limits.hours_per_month),
    questions_today: plan.usage.questions_today,
    questions_day_limit: plan.limits.questions_per_day,
    questions_percentage: plan.usage_percentage.questions,
    questions_remaining: remaining(plan.usage.questions_today, plan.limits.questions_per_day),
    month: "",
    reset_date: plan.renewal_date ?? "",
  };
}

function UsageMeter({ label, used, limit, pct }: { label: string; used: number; limit: number; pct: number }) {
  const unlimited = limit >= UNLIMITED;
  const danger = pct >= 90;
  return (
    <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: color.textFaint }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{used} <span style={{ color: color.textFaint }}>/ {unlimited ? "∞" : limit}</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 100, background: color.surfaceElevated, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${unlimited ? 4 : Math.min(100, pct)}%`, borderRadius: 100, background: danger ? color.danger.fg : "#2B3A67" }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { isMobile } = useViewport();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [stage, setStage] = useState<"overview" | "checkout" | "success">("overview");

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

  useEffect(() => {
    if (!router.isReady || !accessToken) return;
    const { status, tx_ref } = router.query as { status?: string; tx_ref?: string };
    if (!status) { load(); return; }
    (async () => {
      if (tx_ref && status !== "cancelled") {
        try {
          const res = await axios.get(`/api/payments/verify/${tx_ref}`, { headers: authHeader });
          if (res.data.status === "successful") setBanner({ type: "success", message: "Payment successful — your plan is now active." });
          else setBanner({ type: "error", message: "Payment is still processing. We'll update your plan once confirmed." });
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

  // Checkout stage state
  const [selectedPlan, setSelectedPlan] = useState<CatalogPlan | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  // Deep-link support: /billing?plan=pro&cycle=yearly (used by the /payment
  // redirect, and by any other link that wants to jump straight to checkout).
  useEffect(() => {
    if (!router.isReady || catalog.length === 0) return;
    const { plan: planQuery, cycle: cycleQuery } = router.query as { plan?: string; cycle?: string };
    if (!planQuery) return;
    const found = catalog.find((p) => p.plan_type === planQuery);
    if (found && found.plan_type !== "free") {
      setSelectedPlan(found);
      setCycle(cycleQuery === "yearly" ? "yearly" : "monthly");
      setStage("checkout");
    }
    router.replace("/billing", undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, catalog]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSelectPlan(target: CatalogPlan) {
    if (!plan) return;
    const currentRank = PLAN_RANK[plan.plan_type] ?? 0;
    const targetRank = PLAN_RANK[target.plan_type] ?? 0;
    if (targetRank === currentRank) return;

    if (targetRank > currentRank) {
      setSelectedPlan(target);
      setCycle(plan.billing_cycle === "yearly" ? "yearly" : "monthly");
      setCheckoutError(null);
      setStage("checkout");
      return;
    }
    setBusy(target.plan_type);
    try {
      await axios.post("/api/subscriptions/downgrade", { new_plan: target.plan_type }, { headers: authHeader });
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

  const amount = useMemo(() => (!selectedPlan ? 0 : cycle === "yearly" ? selectedPlan.yearly_price : selectedPlan.price), [selectedPlan, cycle]);

  async function handleProceed() {
    if (!selectedPlan || !accessToken) return;
    setProcessing(true);
    setCheckoutError(null);
    try {
      const res = await axios.post("/api/payments/initialize", { plan_type: selectedPlan.plan_type, billing_cycle: cycle }, { headers: authHeader });
      const link = res.data.payment_link;
      if (link) { window.location.href = link; }
      else { setCheckoutError("Payment could not be started. Please try again."); setProcessing(false); }
    } catch (err: unknown) {
      let message = "We couldn't start your payment. Please try again.";
      if (axios.isAxiosError(err)) { const detail = (err.response?.data as { detail?: string })?.detail; if (detail) message = detail; }
      setCheckoutError(message);
      setProcessing(false);
    }
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><div style={{ width: 32, height: 32, border: "3px solid #E4E1D8", borderTopColor: "#2B3A67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>;
  }

  return (
    <>
      <Head><title>Billing & plan — LearnPath AI</title></Head>
      <div style={{ maxWidth: 900, fontFamily: font.body }}>
        {stage === "overview" && (
          <>
            <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: "0 0 4px" }}>Billing & plan</h1>
            <p style={{ fontSize: 13.5, color: color.textFaint, marginBottom: 22 }}>Manage your plan, track usage, and view payment history.</p>

            {banner && (
              <div style={{ marginBottom: 20, display: "flex", gap: 10, borderRadius: 10, padding: 14, background: banner.type === "success" ? color.success.bg : color.danger.bg, color: banner.type === "success" ? color.success.fg : color.danger.fg }}>
                <p style={{ fontSize: 13, margin: 0 }}>{banner.message}</p>
              </div>
            )}
            {error && <div style={{ marginBottom: 20, borderRadius: 10, padding: 14, background: color.danger.bg, color: color.danger.fg, fontSize: 13 }}>{error}</div>}

            {plan && (
              <>
                <Card padding="lg" style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 20 }}>{plan.plan_name}</div>
                      <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 3, textTransform: "capitalize" }}>{plan.status}{plan.plan_type !== "free" && ` · ${plan.billing_cycle}`}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: font.mono, fontSize: 22, fontWeight: 600 }}>{fmtMoney(plan.price_paid)}</div>
                      {plan.plan_type !== "free" && <div style={{ fontSize: 11.5, color: color.textFaint }}>per {plan.billing_cycle === "yearly" ? "year" : "month"}</div>}
                    </div>
                  </div>
                  {plan.plan_type !== "free" && (
                    <div style={{ fontSize: 12.5, color: color.textFaint, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>Renews {fmtDate(plan.renewal_date)}</span>
                      <span style={{ color: plan.auto_renew ? color.success.fg : color.warning.fg }}>Auto-renew {plan.auto_renew ? "on" : "off"}</span>
                      {plan.pending_plan_type && <span style={{ color: color.warning.fg }}>Switching to {plan.pending_plan_type} next renewal</span>}
                    </div>
                  )}
                </Card>

                <UsageAlert data={toUsageData(plan)} />

                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Usage this month</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                  <UsageMeter label="Videos" used={plan.usage.videos_watched} limit={plan.limits.videos_per_month} pct={plan.usage_percentage.videos} />
                  <UsageMeter label="Hours" used={plan.usage.hours_learned} limit={plan.limits.hours_per_month} pct={plan.usage_percentage.hours} />
                  <UsageMeter label="Questions today" used={plan.usage.questions_today} limit={plan.limits.questions_per_day} pct={plan.usage_percentage.questions} />
                </div>

                <div id="plans" style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Plans</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
                  {catalog.map((p) => {
                    const isCurrent = p.plan_type === plan.plan_type;
                    const isUpgrade = (PLAN_RANK[p.plan_type] ?? 0) > (PLAN_RANK[plan.plan_type] ?? 0);
                    return (
                      <Card key={p.plan_type} padding="md" style={{ border: isCurrent ? "1.5px solid #2B3A67" : `1px solid ${color.border}`, background: isCurrent ? "#E9F0FA" : "#fff", display: "flex", flexDirection: "column" }}>
                        <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 600, marginBottom: 10 }}>{fmtMoney(p.price)}<span style={{ fontSize: 12, fontWeight: 400, color: color.textFaint }}>/mo</span></div>
                        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", fontSize: 12.5, color: color.inkSoft, flex: 1 }}>
                          <li style={{ marginBottom: 6 }}>✓ {fmtLimit(p.videos_per_month)} videos / month</li>
                          <li style={{ marginBottom: 6 }}>✓ {fmtLimit(p.hours_per_month)} hours / month</li>
                          <li style={{ marginBottom: 6 }}>✓ {fmtLimit(p.questions_per_day)} questions / day</li>
                          {p.features.map((f) => <li key={f} style={{ marginBottom: 6, textTransform: "capitalize" }}>✓ {f.replace(/_/g, " ")}</li>)}
                        </ul>
                        <button onClick={() => handleSelectPlan(p)} disabled={isCurrent || busy === p.plan_type} style={{ width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 600, borderRadius: 7, border: "none", cursor: isCurrent ? "default" : "pointer", background: isCurrent ? color.surfaceElevated : isUpgrade ? "#2B3A67" : color.surfaceElevated, color: isCurrent ? color.textFaint : isUpgrade ? "#fff" : color.ink }}>
                          {busy === p.plan_type ? "Working…" : isCurrent ? "Current plan" : isUpgrade ? "Upgrade" : "Downgrade"}
                        </button>
                      </Card>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 24 }}><FeatureMatrix highlightPlan={(plan.plan_type as "free" | "pro" | "premium") || "pro"} /></div>

                <div style={{ fontSize: 13, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Billing history</div>
                <Card padding="md" style={{ marginBottom: 24 }}>
                  {history.length === 0 ? <p style={{ fontSize: 13, color: color.textFaint, margin: 0 }}>No billing history yet.</p> : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead><tr style={{ textAlign: "left", color: color.textFaint, borderBottom: `1px solid ${color.borderMuted}` }}><th style={{ padding: "6px 0", fontWeight: 500 }}>Date</th><th style={{ fontWeight: 500 }}>Description</th><th style={{ fontWeight: 500, textAlign: "right" }}>Amount</th><th style={{ fontWeight: 500, textAlign: "right" }}>Status</th></tr></thead>
                        <tbody>
                          {history.map((row) => (
                            <tr key={row.id} style={{ borderBottom: `1px solid ${color.borderMuted}` }}>
                              <td style={{ padding: "10px 0", color: color.inkSoft }}>{fmtDate(row.date)}</td>
                              <td style={{ color: color.inkSoft }}>{row.description || row.plan}</td>
                              <td style={{ textAlign: "right" }}>{fmtMoney(row.amount)}</td>
                              <td style={{ textAlign: "right", color: color.success.fg }}>✓ {row.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {plan.plan_type !== "free" && plan.status === "active" && (
                  <Card padding="lg">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>Cancel subscription</div>
                        <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>Keep access until {fmtDate(plan.renewal_date)}, then move to Free.</div>
                      </div>
                      <button onClick={handleCancel} disabled={busy === "cancel"} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 6, border: `1px solid #E7B7AE`, background: color.danger.bg, color: color.danger.fg, cursor: "pointer" }}>{busy === "cancel" ? "Cancelling…" : "Cancel plan"}</button>
                    </div>
                  </Card>
                )}
                <p style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 11.5, color: color.textFainter, marginTop: 20 }}>Payments secured by Flutterwave</p>
              </>
            )}
          </>
        )}

        {stage === "checkout" && selectedPlan && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => setStage("overview")} style={{ cursor: "pointer", color: "#2B5FA8", fontSize: 13, fontWeight: 600, background: "none", border: "none" }}>← Back</button>
              <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 24, margin: 0 }}>Upgrade your plan</h1>
            </div>

            {checkoutError && <div style={{ marginBottom: 20, borderRadius: 10, padding: 14, background: color.danger.bg, color: color.danger.fg, fontSize: 13 }}>{checkoutError}</div>}

            <div style={{ display: "flex", gap: 6, background: color.surfaceElevated, borderRadius: 8, padding: 3, width: 220, marginBottom: 24 }}>
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} onClick={() => setCycle(c)} style={{ flex: 1, padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer", background: cycle === c ? "#2B3A67" : "transparent", color: cycle === c ? "#fff" : color.inkSoft }}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
              ))}
            </div>

            <Card padding="lg" style={{ maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}><span>{selectedPlan.name} ({cycle})</span><span style={{ fontFamily: font.mono }}>{fmtMoney(amount)}</span></div>
              <button onClick={handleProceed} disabled={processing} style={{ width: "100%", marginTop: 12, padding: "11px 16px", fontSize: 14, fontWeight: 600, borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", cursor: "pointer" }}>{processing ? "Redirecting…" : "Proceed to secure payment"}</button>
              <p style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 11.5, color: color.textFainter, marginTop: 14 }}>256-bit encrypted · Powered by Flutterwave</p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
