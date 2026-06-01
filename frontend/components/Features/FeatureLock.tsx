/**
 * Locked-feature card with upgrade prompt (Packet 4.4).
 *
 * Rendered in-context when a user tries to access a Pro/Premium feature.
 * Feature metadata (description, benefits, required plan) is resolved
 * client-side from the local FEATURE_INFO catalogue — no API round-trip.
 */

import React from "react";
import { useRouter } from "next/router";
import { Lock, Check, Zap, ArrowRight } from "lucide-react";

const NGN = "NGN";

interface FeatureMeta {
  name: string;
  description: string;
  min_plan: "pro" | "premium";
  benefits: string[];
}

const FEATURE_INFO: Record<string, FeatureMeta> = {
  offline_download: {
    name: "Offline Download",
    description: "Download videos to watch without an internet connection.",
    min_plan: "pro",
    benefits: ["Watch anywhere, anytime", "Save mobile data", "No buffering delays"],
  },
  advanced_questions: {
    name: "Advanced Questions",
    description: "Deeper, more challenging questions with detailed explanations.",
    min_plan: "pro",
    benefits: ["Higher-difficulty prompts", "Detailed feedback", "Better long-term retention"],
  },
  ad_free: {
    name: "Ad-Free Experience",
    description: "Learn without upgrade banners or promotional interruptions.",
    min_plan: "pro",
    benefits: ["Zero distractions", "Full focus", "Cleaner interface"],
  },
  custom_paths: {
    name: "Custom Learning Paths",
    description: "Build and share your own curated learning paths.",
    min_plan: "premium",
    benefits: ["Mix any topics", "Share with others", "Save your curation"],
  },
  certificate_generation: {
    name: "Certificates",
    description: "Generate a certificate of completion for any course.",
    min_plan: "premium",
    benefits: ["Shareable PDF", "LinkedIn ready", "Verified by LearnPath AI"],
  },
  priority_support: {
    name: "Priority Support",
    description: "Get help within 4 hours — skip the queue.",
    min_plan: "premium",
    benefits: ["4-hour response SLA", "Dedicated support channel", "Human assistance"],
  },
  api_access: {
    name: "API Access",
    description: "Integrate LearnPath AI into your own tools and workflows.",
    min_plan: "premium",
    benefits: ["Full REST API", "Webhooks", "Programmatic path building"],
  },
};

const PLAN_PRICES: Record<string, number> = { pro: 2999, premium: 9999 };

interface FeatureLockProps {
  feature: string;
  userPlan?: string;
  className?: string;
  onUpgrade?: () => void;
}

export default function FeatureLock({ feature, userPlan, className = "", onUpgrade }: FeatureLockProps) {
  const router = useRouter();
  const info = FEATURE_INFO[feature];
  const plan = (userPlan || "free").toLowerCase();

  // Don't render lock for users who already have access
  if (plan === "pro" || plan === "premium") {
    const requiredPlan = info?.min_plan ?? "pro";
    if (
      (requiredPlan === "pro" && (plan === "pro" || plan === "premium")) ||
      (requiredPlan === "premium" && plan === "premium")
    ) {
      return null;
    }
  }

  const meta = info ?? {
    name: feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "This feature requires a higher plan.",
    min_plan: "pro" as const,
    benefits: [],
  };

  const requiredPlan = meta.min_plan;
  const price = PLAN_PRICES[requiredPlan] ?? 0;
  const isPremium = requiredPlan === "premium";
  const upgradeUrl = `/billing?plan=${requiredPlan}`;

  function handleUpgrade() {
    onUpgrade?.();
    router.push(upgradeUrl);
  }

  return (
    <div
      className={`bg-surface-elevated border border-border rounded-2xl p-6 flex flex-col items-center text-center ${className}`}
    >
      {/* Lock icon */}
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
          isPremium ? "bg-purple-500/15 text-purple-400" : "bg-accent-muted text-accent-light"
        }`}
      >
        {isPremium ? <Zap size={28} /> : <Lock size={28} />}
      </div>

      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full mb-3 ${
          isPremium
            ? "bg-purple-500/15 text-purple-400"
            : "bg-accent-muted text-accent-light"
        }`}
      >
        {requiredPlan} feature
      </span>

      <h3 className="text-lg font-semibold text-white mb-2">{meta.name}</h3>
      <p className="text-sm text-white/50 mb-5 max-w-xs">{meta.description}</p>

      {/* Benefits */}
      {meta.benefits.length > 0 && (
        <ul className="space-y-2 mb-6 w-full max-w-xs text-left">
          {meta.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-sm text-white/60">
              <Check size={14} className="text-success shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {/* Plan comparison */}
      <div className="flex items-center gap-3 text-xs text-white/40 mb-5">
        <span className="px-2.5 py-1 rounded-lg bg-surface-hover">
          Current: {plan.charAt(0).toUpperCase() + plan.slice(1)}
        </span>
        <ArrowRight size={12} />
        <span
          className={`px-2.5 py-1 rounded-lg ${
            isPremium ? "bg-purple-500/15 text-purple-400" : "bg-accent-muted text-accent-light"
          }`}
        >
          Required: {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleUpgrade}
        className="w-full max-w-xs py-3 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mb-2"
      >
        Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
        <span className="text-white/60 font-normal">&mdash; {NGN} {price.toLocaleString()}/mo</span>
      </button>
      <button
        type="button"
        onClick={() => router.push("/billing")}
        className="text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        Compare all plans
      </button>
    </div>
  );
}
