import React, { useEffect, useState } from "react";
import { X, Check, AlertTriangle, Printer } from "lucide-react";
import { Button } from "../ui";

// ── Shell ──────────────────────────────────────────────────────────────────

function Shell({
  title, onClose, children, footer, wide = false,
}: {
  title: string; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-2xl border border-border bg-surface-elevated p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/50 hover:bg-surface hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface BillingPlan {
  plan_id: string;
  plan_slug: string;
  plan_name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  features: {
    max_teachers: number; max_students: number; max_classes: number;
    storage_gb: number; max_api_calls: number;
    sso: boolean; advanced_analytics: boolean; support: string;
  };
  is_current?: boolean;
  additional_monthly?: number;
  limit_warnings?: { teachers: boolean; students: boolean; classes: boolean; storage: boolean };
}

export interface InvoiceDetail {
  invoice_id: string; invoice_number: string; invoice_date: string;
  billing_period_start: string | null; billing_period_end: string | null;
  total: number; subtotal: number; tax: number; tax_rate: number;
  status: string; paid_at: string | null; notes: string | null;
  line_items: { description: string; quantity: number; unit_price: number; total: number }[];
  school_name: string; billing_contact: string | null; billing_email: string | null;
}

// ── Plan Comparison Modal ─────────────────────────────────────────────────

const FMT_NUM = (n: number) =>
  n >= 999_999 ? "Unlimited" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

export function PlanComparisonModal({
  plans, currentSlug, onUpgrade, onClose,
}: {
  plans: BillingPlan[]; currentSlug: string;
  onUpgrade: (slug: string) => void; onClose: () => void;
}) {
  return (
    <Shell title="Compare plans" onClose={onClose} wide>
      <div className="grid grid-cols-3 gap-4">
        {plans.map((p) => {
          const isCurrent = p.plan_slug === currentSlug;
          const hasWarning = p.limit_warnings && Object.values(p.limit_warnings).some(Boolean);
          return (
            <div key={p.plan_id}
              className={`rounded-xl border p-4 ${isCurrent ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
              <div className="mb-3">
                <p className="text-sm font-semibold text-white">{p.plan_name}</p>
                {isCurrent && <span className="text-xs text-accent">Current plan</span>}
                <p className="mt-1 text-2xl font-bold text-white">${p.monthly_price}<span className="text-sm font-normal text-white/40">/mo</span></p>
                <p className="text-xs text-white/40">${p.annual_price}/yr</p>
              </div>
              <ul className="space-y-1.5 text-xs text-white/60">
                <LimitRow label="Teachers" value={FMT_NUM(p.features.max_teachers)} warn={p.limit_warnings?.teachers} />
                <LimitRow label="Students" value={FMT_NUM(p.features.max_students)} warn={p.limit_warnings?.students} />
                <LimitRow label="Classes"  value={FMT_NUM(p.features.max_classes)} warn={p.limit_warnings?.classes} />
                <LimitRow label="Storage"  value={`${p.features.storage_gb} GB`} warn={p.limit_warnings?.storage} />
                <LimitRow label="API calls" value={FMT_NUM(p.features.max_api_calls)} />
                <li className="flex items-center gap-1.5">
                  {p.features.sso ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-white/30" />}
                  SSO
                </li>
                <li className="flex items-center gap-1.5">
                  {p.features.advanced_analytics ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-white/30" />}
                  Advanced analytics
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {p.features.support === "dedicated" ? "Dedicated support" : "Email support"}
                </li>
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <p className="text-center text-xs text-white/40">Your current plan</p>
                ) : (
                  <Button fullWidth size="sm"
                    variant={hasWarning ? "ghost" : "primary"}
                    onClick={() => { onUpgrade(p.plan_slug); onClose(); }}>
                    {(p.additional_monthly ?? 0) > 0 ? `Upgrade +$${p.additional_monthly}/mo` : "Switch plan"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function LimitRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <li className={`flex justify-between ${warn ? "text-amber-400" : ""}`}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

// ── Upgrade Confirmation Modal ─────────────────────────────────────────────

export function UpgradeModal({
  plan, currentMonthly, renewsAt, onConfirm, onClose,
}: {
  plan: BillingPlan; currentMonthly: number; renewsAt: string | null;
  onConfirm: (slug: string, cycle: string) => Promise<void>; onClose: () => void;
}) {
  const [cycle, setCycle] = useState("monthly");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const renewDate = renewsAt ? new Date(renewsAt) : new Date();
  const daysLeft = Math.max(1, Math.round((renewDate.getTime() - Date.now()) / 86_400_000));
  const delta = plan.monthly_price - currentMonthly;
  const proration = Math.round((delta / 30) * daysLeft * 100) / 100;
  const price = cycle === "annual" ? (plan.annual_price / 12) : plan.monthly_price;

  async function submit() {
    setLoading(true);
    await onConfirm(plan.plan_slug, cycle);
    setLoading(false);
  }

  return (
    <Shell title={`Upgrade to ${plan.plan_name}`} onClose={onClose}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button size="sm" onClick={submit} loading={loading} disabled={!confirmed}>
          {proration > 0 ? `Pay $${proration.toFixed(2)} now` : "Confirm upgrade"}
        </Button>
      </>}>
      <div className="rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between text-white/60"><span>Current plan</span><span>${currentMonthly}/mo</span></div>
        <div className="flex justify-between font-semibold text-white"><span>New plan ({plan.plan_name})</span><span>${price.toFixed(2)}/mo</span></div>
        {delta !== 0 && <div className="mt-1 flex justify-between text-white/50"><span>Change</span><span className={delta > 0 ? "text-amber-400" : "text-success"}>{delta > 0 ? "+" : ""}${delta}/mo</span></div>}
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <input type="radio" name="cycle" value="monthly" checked={cycle === "monthly"} onChange={() => setCycle("monthly")} className="text-accent" />
          <div>
            <p className="font-medium text-white">Monthly — ${plan.monthly_price}/mo</p>
            <p className="text-xs text-white/40">Billed each month, cancel anytime</p>
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <input type="radio" name="cycle" value="annual" checked={cycle === "annual"} onChange={() => setCycle("annual")} className="text-accent" />
          <div>
            <p className="font-medium text-white">Annual — ${(plan.annual_price / 12).toFixed(0)}/mo <span className="text-xs text-success">save 17%</span></p>
            <p className="text-xs text-white/40">${plan.annual_price}/year billed annually</p>
          </div>
        </label>
      </div>

      {proration > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-300">Proration charge</p>
          <p className="mt-0.5 text-white/60">You&apos;ll be charged <strong className="text-white">${proration.toFixed(2)}</strong> today for the remaining {daysLeft} days in your billing cycle. Your new monthly rate starts on {renewDate.toLocaleDateString()}.</p>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-surface text-accent" />
        I confirm the plan upgrade and authorise the charge
      </label>
    </Shell>
  );
}

// ── Invoice Detail Modal ───────────────────────────────────────────────────

export function InvoiceDetailModal({
  inv, onEmail, onClose,
}: {
  inv: InvoiceDetail; onEmail: () => void; onClose: () => void;
}) {
  const [emailing, setEmailing] = useState(false);

  async function handleEmail() {
    setEmailing(true);
    await onEmail();
    setEmailing(false);
  }

  return (
    <Shell title={`Invoice ${inv.invoice_number}`} onClose={onClose}
      footer={<>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
        </Button>
        <Button size="sm" onClick={handleEmail} loading={emailing}>Email invoice</Button>
      </>}>
      <div className="space-y-4 text-sm print:text-black">
        <div className="flex justify-between">
          <div>
            <p className="font-semibold text-white">{inv.school_name}</p>
            {inv.billing_contact && <p className="text-white/50">{inv.billing_contact}</p>}
            {inv.billing_email && <p className="text-white/50">{inv.billing_email}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold text-white">{inv.invoice_number}</p>
            <p className="text-white/50">{new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === "paid" ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-400"}`}>{inv.status}</span>
          </div>
        </div>

        {inv.billing_period_start && (
          <p className="text-xs text-white/40">
            Billing period: {new Date(inv.billing_period_start).toLocaleDateString()} — {new Date(inv.billing_period_end!).toLocaleDateString()}
          </p>
        )}

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-white/40">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.line_items || []).map((li, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2 text-white/70">{li.description}</td>
                <td className="py-2 text-right text-white/70">{li.quantity}</td>
                <td className="py-2 text-right text-white/70">${li.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right text-white">${li.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-48 space-y-1 text-xs">
          <div className="flex justify-between text-white/50"><span>Subtotal</span><span>${inv.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-white/50"><span>Tax ({inv.tax_rate}%)</span><span>${(inv.tax || 0).toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-white"><span>Total</span><span>${inv.total.toFixed(2)}</span></div>
          {inv.paid_at && (
            <div className="flex justify-between text-success"><span>Paid</span><span>{new Date(inv.paid_at).toLocaleDateString()}</span></div>
          )}
        </div>

        {inv.notes && <p className="text-xs text-white/40">{inv.notes}</p>}
      </div>
    </Shell>
  );
}
