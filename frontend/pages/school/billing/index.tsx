import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Badge, Button, Modal, ModalTitle, InlineError, type BadgeTone } from "../../../ui-v2/primitives";
import { color, font } from "../../../ui-v2/tokens";

type Tab = "plan" | "invoices";

interface UsageStat { used: number; limit: number; pct: number }
interface ForecastWarning { metric: string; current: number; projected_90d: number; limit: number; days_until_limit: number; severity: string }
interface Overview {
  subscription: {
    plan_name: string; plan_slug: string; monthly_price: number; billing_cycle: string; status: string;
    auto_renew: boolean; renews_at: string | null; days_until_renewal: number;
  };
  usage: { teachers: UsageStat; students: UsageStat; classes: UsageStat; storage_gb: UsageStat; api_calls: UsageStat };
  forecast: ForecastWarning[];
  recommended_plan: (BillingPlan & { additional_monthly: number }) | null;
  recent_invoices: { invoice_id: string; invoice_number: string; invoice_date: string; total: number; status: string }[];
}
interface BillingPlan {
  plan_id: string; plan_slug: string; plan_name: string; description: string;
  monthly_price: number; annual_price: number;
  features: { max_teachers: number; max_students: number; max_classes: number; storage_gb: number; max_api_calls: number; sso: boolean; advanced_analytics: boolean; support: string };
  is_current?: boolean; additional_monthly?: number;
  limit_warnings?: { teachers: boolean; students: boolean; classes: boolean; storage: boolean };
}
interface InvoiceRow { invoice_id: string; invoice_number: string; invoice_date: string; total: number; status: string }
interface InvoiceDetail {
  invoice_id: string; invoice_number: string; invoice_date: string;
  billing_period_start: string | null; billing_period_end: string | null;
  total: number; subtotal: number; tax: number; tax_rate: number;
  status: string; paid_at: string | null; notes: string | null;
  line_items: { description: string; quantity: number; unit_price: number; total: number }[];
  school_name: string; billing_contact: string | null; billing_email: string | null;
}

const FMT_NUM = (n: number) => (n >= 999_999 ? "Unlimited" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n));

function meterColor(pct: number): string {
  return pct >= 90 ? color.danger.fg : pct >= 75 ? color.warning.fg : color.success.fg;
}

function UsageMeter({ label, used, limit, pct, warn }: { label: string; used: string | number; limit: string | number; pct: number; warn?: string }) {
  const c = meterColor(pct);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ fontFamily: font.mono, color: c }}>{used}/{limit}</span>
      </div>
      <div style={{ height: 6, background: color.surfaceElevated, borderRadius: 100, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: c, borderRadius: 100 }} />
      </div>
      {warn && <div style={{ fontSize: 11, color: c, marginTop: 4 }}>{warn}</div>}
    </div>
  );
}

// ── Plan comparison modal ────────────────────────────────────────────────

function PlanComparisonModal({ plans, currentSlug, onUpgrade, onClose }: { plans: BillingPlan[]; currentSlug: string; onUpgrade: (slug: string) => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose} width={860}>
      <ModalTitle>Compare plans</ModalTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {plans.map((p) => {
          const isCurrent = p.plan_slug === currentSlug;
          return (
            <div key={p.plan_id} style={{ borderRadius: 12, padding: 18, border: `1.5px solid ${isCurrent ? "#2B3A67" : color.border}`, background: isCurrent ? color.info.bg : "#fff" }}>
              <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.plan_name}</div>
              {isCurrent && <div style={{ fontSize: 11, color: "#2B3A67", marginBottom: 6 }}>Current plan</div>}
              <div style={{ fontFamily: font.mono, fontSize: 19, fontWeight: 600, marginBottom: 10 }}>${p.monthly_price}<span style={{ fontSize: 11, fontWeight: 400, color: color.textFaint }}>/mo</span></div>
              <div style={{ display: "grid", gap: 5, fontSize: 12, color: color.inkSoft, marginBottom: 12 }}>
                <div>✓ {FMT_NUM(p.features.max_teachers)} teachers</div>
                <div>✓ {FMT_NUM(p.features.max_students)} students</div>
                <div>✓ {p.features.storage_gb} GB storage</div>
                {p.features.sso && <div>✓ SSO</div>}
                {p.features.advanced_analytics && <div>✓ Advanced analytics</div>}
              </div>
              {isCurrent ? (
                <div style={{ textAlign: "center", fontSize: 11.5, color: color.textFaint }}>Your current plan</div>
              ) : (
                <Button fullWidth size="sm" onClick={() => { onUpgrade(p.plan_slug); onClose(); }}>
                  {(p.additional_monthly ?? 0) > 0 ? `Upgrade +$${p.additional_monthly}/mo` : "Switch plan"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Upgrade confirmation modal ───────────────────────────────────────────

function UpgradeModal({ plan, currentMonthly, renewsAt, onConfirm, onClose }: { plan: BillingPlan; currentMonthly: number; renewsAt: string | null; onConfirm: (slug: string, cycle: string) => Promise<void>; onClose: () => void }) {
  const [cycle, setCycle] = useState("monthly");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const renewDate = renewsAt ? new Date(renewsAt) : new Date();
  const daysLeft = Math.max(1, Math.round((renewDate.getTime() - Date.now()) / 86_400_000));
  const delta = plan.monthly_price - currentMonthly;
  const proration = Math.round((delta / 30) * daysLeft * 100) / 100;
  const price = cycle === "annual" ? plan.annual_price / 12 : plan.monthly_price;

  async function submit() {
    setLoading(true);
    await onConfirm(plan.plan_slug, cycle);
    setLoading(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Upgrade to {plan.plan_name}</ModalTitle>
      <div style={{ background: color.surfaceMuted, borderRadius: 10, padding: 14, fontSize: 13, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: color.textFaint }}><span>Current plan</span><span>${currentMonthly}/mo</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>New plan ({plan.plan_name})</span><span>${price.toFixed(2)}/mo</span></div>
      </div>
      <div style={{ display: "flex", gap: 6, background: color.surfaceElevated, borderRadius: 8, padding: 3, width: 200, marginBottom: 16 }}>
        {(["monthly", "annual"] as const).map((c) => (
          <button key={c} onClick={() => setCycle(c)} style={{ flex: 1, padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer", background: cycle === c ? "#2B3A67" : "transparent", color: cycle === c ? "#fff" : color.inkSoft }}>
            {c === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>
      {proration > 0 && (
        <div style={{ borderRadius: 8, background: color.warning.bg, padding: 12, fontSize: 12.5, color: color.warning.fg, marginBottom: 16, lineHeight: 1.5 }}>
          You&apos;ll be charged <b>${proration.toFixed(2)}</b> today for the remaining {daysLeft} days in your billing cycle.
        </div>
      )}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: color.inkSoft, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
        I confirm the plan upgrade and authorise the charge.
      </label>
      <Button fullWidth disabled={!confirmed || loading} onClick={submit}>{loading ? "Processing…" : proration > 0 ? `Pay $${proration.toFixed(2)} now` : "Confirm upgrade"}</Button>
    </Modal>
  );
}

// ── Invoice detail modal ─────────────────────────────────────────────────

function InvoiceDetailModal({ inv, onEmail, onClose }: { inv: InvoiceDetail; onEmail: () => void; onClose: () => void }) {
  const [emailing, setEmailing] = useState(false);
  async function handleEmail() {
    setEmailing(true);
    await onEmail();
    setEmailing(false);
  }
  return (
    <Modal onClose={onClose} width={560}>
      <ModalTitle>Invoice {inv.invoice_number}</ModalTitle>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{inv.school_name}</div>
          {inv.billing_contact && <div style={{ color: color.textFaint }}>{inv.billing_contact}</div>}
          {inv.billing_email && <div style={{ color: color.textFaint }}>{inv.billing_email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
          <div style={{ color: color.textFaint }}>{new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
          <Badge tone={inv.status === "paid" ? "success" : "neutral"}>{inv.status}</Badge>
        </div>
      </div>
      <table style={{ width: "100%", fontSize: 12, marginBottom: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${color.border}`, textAlign: "left", color: color.textFaint }}>
            <th style={{ paddingBottom: 6 }}>Description</th>
            <th style={{ paddingBottom: 6, textAlign: "right" }}>Qty</th>
            <th style={{ paddingBottom: 6, textAlign: "right" }}>Unit</th>
            <th style={{ paddingBottom: 6, textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(inv.line_items || []).map((li, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${color.borderMuted}` }}>
              <td style={{ padding: "6px 0" }}>{li.description}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{li.quantity}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>${li.unit_price.toFixed(2)}</td>
              <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 600 }}>${li.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginLeft: "auto", width: 200, fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: color.textFaint }}><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", color: color.textFaint }}><span>Tax ({inv.tax_rate}%)</span><span>${(inv.tax || 0).toFixed(2)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${color.border}`, paddingTop: 4, fontWeight: 600 }}><span>Total</span><span>${inv.total.toFixed(2)}</span></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
        <Button disabled={emailing} onClick={handleEmail}>{emailing ? "Sending…" : "Email invoice"}</Button>
      </div>
    </Modal>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

export default function SchoolBillingPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const tab: Tab = (router.query.tab as Tab) || "plan";
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(1);
  const [selectedInv, setSelectedInv] = useState<InvoiceDetail | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const sid = typeof window !== "undefined" ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id") : null;
    setSchoolId(sid);
  }, []);

  const loadPlan = useCallback(async (sid: string) => {
    setLoading(true); setError(null);
    try {
      const [ov, pl] = await Promise.all([
        fetch(`/api/school-admin/${sid}/billing/overview`, { headers: auth }).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/school-admin/${sid}/billing/plan-comparison`, { headers: auth }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (!ov) throw new Error();
      setData(ov);
      setPlans(pl?.plans ?? []);
    } catch { setError("Couldn't load billing data."); } finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoices = useCallback(async (sid: string, pg: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/school-admin/${sid}/billing/invoices?page=${pg}&page_size=20`, { headers: auth });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setInvoices(d.invoices ?? []);
      setInvTotal(d.pagination?.total ?? 0);
    } catch { setError("Couldn't load invoices."); } finally { setLoading(false); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!schoolId) return;
    if (tab === "plan") loadPlan(schoolId);
    else loadInvoices(schoolId, invPage);
  }, [schoolId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doUpgrade(slug: string, cycle: string) {
    if (!schoolId) return;
    await fetch(`/api/school-admin/${schoolId}/billing/upgrade`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ plan_slug: slug, billing_cycle: cycle }),
    });
    setUpgradePlan(null);
    loadPlan(schoolId);
  }

  function openUpgrade(slug: string) {
    const plan = plans.find((p) => p.plan_slug === slug);
    if (plan) setUpgradePlan(plan);
  }

  async function openDetail(invId: string) {
    if (!schoolId) return;
    const res = await fetch(`/api/school-admin/${schoolId}/billing/invoices/${invId}`, { headers: auth });
    if (res.ok) setSelectedInv(await res.json());
  }

  async function emailInvoice(invId: string) {
    if (!schoolId) return;
    setEmailingId(invId);
    await fetch(`/api/school-admin/${schoolId}/billing/invoices/${invId}/email`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    setEmailingId(null);
    setToast("Invoice emailed.");
    setTimeout(() => setToast(""), 3000);
    loadInvoices(schoolId, invPage);
  }

  const sub = data?.subscription;
  const usage = data?.usage;
  const pages = Math.max(1, Math.ceil(invTotal / 20));

  if (!schoolId) return <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>;

  return (
    <>
      <Head><title>Billing — LearnPath AI</title></Head>
      <div style={{ maxWidth: 1180, fontFamily: font.body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h1 style={{ fontFamily: font.display, fontWeight: 600, fontSize: 28, margin: 0 }}>Billing</h1>
          <Link href="/school/dashboard" style={{ fontSize: 13, fontWeight: 600, color: "#2B5FA8", textDecoration: "none" }}>← Back to dashboard</Link>
        </div>
        <div style={{ fontSize: 13, color: color.textFaint, marginBottom: 22 }}>Manage your subscription, usage, and invoices.</div>

        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {(["plan", "invoices"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => router.push(`/school/billing?tab=${t}`, undefined, { shallow: true })}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 100, cursor: "pointer",
                border: `1px solid ${tab === t ? "#2B3A67" : color.border}`,
                background: tab === t ? "#2B3A67" : "#fff",
                color: tab === t ? "#fff" : color.inkSoft,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {toast && <div style={{ fontSize: 12.5, color: color.success.fg, marginBottom: 12 }}>{toast}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: color.textFaint }}>Loading…</div>
        ) : error ? (
          <InlineError message={error} onRetry={() => (tab === "plan" ? loadPlan(schoolId) : loadInvoices(schoolId, invPage))} />
        ) : tab === "plan" && data && sub && usage ? (
          <>
            {data.forecast.length > 0 && (
              <div style={{ border: `1px solid ${color.danger.fg}`, background: color.danger.bg, borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, color: "#7A2A20", maxWidth: 640, lineHeight: 1.5 }}>
                  90-day forecast: {data.forecast.map((w) => w.metric).join(" and ")} projected to exceed your plan&apos;s limit.
                  {data.recommended_plan && ` We recommend ${data.recommended_plan.plan_name}.`}
                </div>
                <Button size="sm" onClick={() => setShowComparison(true)}>Review upgrade</Button>
              </div>
            )}

            <Card padding="lg" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.textFaint, marginBottom: 6 }}>Current plan</div>
                  <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 22 }}>{sub.plan_name} · ${sub.monthly_price}/mo</div>
                  <div style={{ fontSize: 12.5, color: color.textFaint, marginTop: 4 }}>
                    Renews in {sub.days_until_renewal} days{sub.renews_at && ` (${new Date(sub.renews_at).toLocaleDateString()})`} · Auto-renew {sub.auto_renew ? "on" : "off"}
                  </div>
                </div>
                <Button onClick={() => setShowComparison(true)}>Compare plans</Button>
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: color.inkSoft, marginBottom: 12 }}>Usage vs. plan limits</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                <UsageMeter label="Teachers" used={usage.teachers.used} limit={usage.teachers.limit} pct={usage.teachers.pct} />
                <UsageMeter label="Students" used={usage.students.used} limit={usage.students.limit} pct={usage.students.pct} />
                <UsageMeter label="Classes" used={usage.classes.used} limit={usage.classes.limit} pct={usage.classes.pct} />
                <UsageMeter label="Storage" used={`${usage.storage_gb.used}GB`} limit={`${usage.storage_gb.limit}GB`} pct={usage.storage_gb.pct} />
                <UsageMeter label="API calls" used={usage.api_calls.used.toLocaleString()} limit={usage.api_calls.limit.toLocaleString()} pct={usage.api_calls.pct} />
              </div>
            </Card>

            {data.recent_invoices.length > 0 && (
              <Card padding="sm">
                <div style={{ fontSize: 13, fontWeight: 600, padding: "8px 10px 12px" }}>Recent invoices</div>
                {data.recent_invoices.map((inv, i) => (
                  <div key={inv.invoice_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 10px", borderTop: `1px solid ${color.borderMuted}`, fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: 11.5, color: color.textFaint }}>{new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: font.mono, fontWeight: 600 }}>${inv.total.toFixed(2)}</span>
                      <Badge tone={inv.status === "paid" ? "success" : "neutral"}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
                <div style={{ padding: "10px" }}>
                  <a onClick={() => router.push("/school/billing?tab=invoices", undefined, { shallow: true })} style={{ fontSize: 12.5, color: "#2B5FA8", cursor: "pointer" }}>View all invoices →</a>
                </div>
              </Card>
            )}
          </>
        ) : tab === "invoices" ? (
          invoices.length === 0 ? (
            <Card padding="lg" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No invoices yet</div>
              <div style={{ fontSize: 12.5, color: color.textFaint }}>Invoices appear here once your first billing cycle completes.</div>
            </Card>
          ) : (
            <>
              <Card padding="sm" style={{ overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 120px 1fr 100px 140px", padding: "12px 18px", fontSize: 11.5, fontWeight: 600, color: color.textFaint, borderBottom: `1px solid ${color.border}` }}>
                  <div>DATE</div><div>NUMBER</div><div></div><div>TOTAL</div><div>STATUS</div>
                </div>
                {invoices.map((inv) => (
                  <div key={inv.invoice_id} style={{ display: "grid", gridTemplateColumns: "110px 120px 1fr 100px 140px", padding: "14px 18px", alignItems: "center", borderBottom: `1px solid ${color.borderMuted}`, fontSize: 13 }}>
                    <div style={{ fontFamily: font.mono, color: color.textFaint }}>{new Date(inv.invoice_date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}</div>
                    <button onClick={() => openDetail(inv.invoice_id)} style={{ fontFamily: font.mono, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", color: "#2B5FA8" }}>{inv.invoice_number}</button>
                    <div />
                    <div style={{ fontFamily: font.mono, fontWeight: 600 }}>${inv.total.toFixed(2)}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge tone={inv.status === "paid" ? "success" : "warning"}>{inv.status}</Badge>
                      <button disabled={emailingId === inv.invoice_id} onClick={() => emailInvoice(inv.invoice_id)} style={{ fontSize: 11.5, color: "#2B5FA8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Email</button>
                    </div>
                  </div>
                ))}
              </Card>
              {pages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12.5, color: color.textFaint }}>
                  <span>Page {invPage} of {pages}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button size="sm" variant="secondary" disabled={invPage === 1} onClick={() => { const p = invPage - 1; setInvPage(p); loadInvoices(schoolId, p); }}>Previous</Button>
                    <Button size="sm" variant="secondary" disabled={invPage === pages} onClick={() => { const p = invPage + 1; setInvPage(p); loadInvoices(schoolId, p); }}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )
        ) : null}
      </div>

      {showComparison && data && (
        <PlanComparisonModal plans={plans} currentSlug={data.subscription.plan_slug} onUpgrade={openUpgrade} onClose={() => setShowComparison(false)} />
      )}
      {upgradePlan && data && (
        <UpgradeModal plan={upgradePlan} currentMonthly={data.subscription.monthly_price} renewsAt={data.subscription.renews_at} onConfirm={doUpgrade} onClose={() => setUpgradePlan(null)} />
      )}
      {selectedInv && (
        <InvoiceDetailModal inv={selectedInv} onEmail={() => emailInvoice(selectedInv.invoice_id)} onClose={() => setSelectedInv(null)} />
      )}
    </>
  );
}
