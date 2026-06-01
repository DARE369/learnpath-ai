/**
 * Feature comparison table across Free / Pro / Premium (Packet 4.4).
 *
 * Fully client-side — no API call needed. The feature matrix is hardcoded
 * here and on the backend; both must be kept in sync.
 *
 * Mobile: horizontally scrollable table with a sticky feature-name column.
 */

import React, { useState } from "react";
import { useRouter } from "next/router";
import { Check, Minus, Info } from "lucide-react";

interface FeatureRow {
  key: string;
  label: string;
  note?: string; // e.g. "10/month"
  free: boolean | string;
  pro: boolean | string;
  premium: boolean | string;
  group?: string;
}

const ROWS: FeatureRow[] = [
  // Core
  { key: "browse",    label: "Browse courses",           free: true,        pro: true,        premium: true,      group: "Core" },
  { key: "watch",     label: "Watch videos",             free: "10/month",  pro: "100/month", premium: "Unlimited", group: "Core" },
  { key: "progress",  label: "Progress dashboard",       free: true,        pro: true,        premium: true,      group: "Core" },
  { key: "questions", label: "Active recall questions",  free: "5/day",     pro: "20/day",    premium: "Unlimited", group: "Core" },
  { key: "branching", label: "Concept branching",        free: true,        pro: true,        premium: true,      group: "Core" },
  { key: "search",    label: "AI search & path building",free: "2/hour",    pro: "10/hour",   premium: "Unlimited", group: "Core" },
  // Pro
  { key: "offline",   label: "Offline download",         free: false,       pro: true,        premium: true,      group: "Pro+" },
  { key: "adfree",    label: "Ad-free experience",       free: false,       pro: true,        premium: true,      group: "Pro+" },
  { key: "advq",      label: "Advanced question depth",  free: false,       pro: true,        premium: true,      group: "Pro+" },
  // Premium
  { key: "paths",     label: "Custom learning paths",    free: false,       pro: false,       premium: true,      group: "Premium" },
  { key: "certs",     label: "Certificate generation",   free: false,       pro: false,       premium: true,      group: "Premium" },
  { key: "support",   label: "Priority support (4h SLA)",free: false,       pro: false,       premium: true,      group: "Premium" },
  { key: "api",       label: "API access",               free: false,       pro: false,       premium: true,      group: "Premium" },
];

type Plan = "free" | "pro" | "premium";

const PLAN_PRICES: Record<Plan, number> = { free: 0, pro: 2999, premium: 9999 };
const PLAN_LABELS: Record<Plan, string> = { free: "Free", pro: "Pro", premium: "Premium" };
const PLANS: Plan[] = ["free", "pro", "premium"];

function Cell({ value, highlight }: { value: boolean | string; highlight: boolean }) {
  if (value === false) {
    return <Minus size={14} className="text-white/20 mx-auto" />;
  }
  if (value === true) {
    return <Check size={15} className={`mx-auto ${highlight ? "text-success" : "text-white/40"}`} />;
  }
  return (
    <span className={`text-xs font-medium ${highlight ? "text-accent-light" : "text-white/50"}`}>
      {value}
    </span>
  );
}

interface FeatureMatrixProps {
  highlightPlan?: Plan;
  className?: string;
}

export default function FeatureMatrix({ highlightPlan = "pro", className = "" }: FeatureMatrixProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<string | null>(null);

  const groups = Array.from(new Set(ROWS.map((r) => r.group).filter(Boolean)));

  return (
    <div className={`bg-surface-elevated border border-border rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-lg font-semibold text-white">Feature Comparison</h2>
        <p className="text-sm text-white/40 mt-0.5">See exactly what each plan includes</p>
      </div>

      {/* Table — horizontally scrollable on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px]">
          {/* Plan headers */}
          <thead>
            <tr className="border-b border-border">
              <th className="py-4 px-6 text-left text-xs font-medium text-white/40 w-[44%]">
                Feature
              </th>
              {PLANS.map((p) => (
                <th
                  key={p}
                  className={`py-4 px-3 text-center text-xs font-semibold w-[18%] ${
                    p === highlightPlan ? "text-accent-light" : "text-white/60"
                  }`}
                >
                  <div>{PLAN_LABELS[p]}</div>
                  {PLAN_PRICES[p] > 0 && (
                    <div className="text-white/30 font-normal mt-0.5">
                      NGN {PLAN_PRICES[p].toLocaleString()}/mo
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group}>
                {/* Group label */}
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 pt-4 pb-1 text-[11px] font-semibold text-white/30 uppercase tracking-widest"
                  >
                    {group}
                  </td>
                </tr>

                {ROWS.filter((r) => r.group === group).map((row, idx) => (
                  <tr
                    key={row.key}
                    className="border-t border-border/40 hover:bg-surface-hover/30 transition-colors"
                  >
                    {/* Feature name */}
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/70">{row.label}</span>
                        {row.note && (
                          <span className="text-xs text-white/30">({row.note})</span>
                        )}
                      </div>
                    </td>

                    {PLANS.map((p) => (
                      <td key={p} className={`py-3 px-3 text-center ${p === highlightPlan ? "bg-accent-muted/30" : ""}`}>
                        <Cell value={row[p]} highlight={p === highlightPlan} />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA row */}
      <div className="grid grid-cols-3 gap-3 px-6 py-5 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-white/30 mb-2">Free Plan</p>
          <button
            type="button"
            onClick={() => router.push("/billing")}
            className="w-full py-2 rounded-xl bg-surface-hover text-white/50 text-xs font-medium hover:text-white/80 transition-colors"
          >
            Current plan
          </button>
        </div>
        <div className="text-center">
          <p className="text-xs text-accent-light mb-2">Pro — NGN 2,999/mo</p>
          <button
            type="button"
            onClick={() => router.push("/billing?plan=pro")}
            className="w-full py-2 rounded-xl bg-gradient-accent text-white text-xs font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
          >
            Upgrade to Pro
          </button>
        </div>
        <div className="text-center">
          <p className="text-xs text-purple-400 mb-2">Premium — NGN 9,999/mo</p>
          <button
            type="button"
            onClick={() => router.push("/billing?plan=premium")}
            className="w-full py-2 rounded-xl bg-purple-600/80 text-white text-xs font-semibold hover:bg-purple-600 transition-colors"
          >
            Go Premium
          </button>
        </div>
      </div>
    </div>
  );
}
