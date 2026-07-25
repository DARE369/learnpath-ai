/**
 * Internal upgrade-CTA banner for free-tier users (Packet 4.3).
 *
 * Rotates through hardcoded upgrade CTAs every 5 minutes using a client-side
 * timer. Returns null for paid users so callers can render it unconditionally.
 *
 * "Ads" here are LearnPath AI's own upgrade prompts, not third-party ads.
 *
 * Orphaned by the ui-v2 Dashboard migration — the new Dashboard design has
 * no ad/upgrade banner and this had no other caller. It's revenue-relevant,
 * so before deleting it, decide where this nudge should live now rather
 * than just dropping it.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { TrendingUp, X, ChevronRight } from "lucide-react";

interface Ad {
  id: string;
  title: string;
  description: string;
  cta_text: string;
  cta_url: string;
}

const BANNER_ADS: Ad[] = [
  {
    id: "cta-pro-videos",
    title: "Watch 10x more videos",
    description: "Upgrade to Pro — 100 videos/month, offline access, no ads.",
    cta_text: "Upgrade to Pro",
    cta_url: "/billing?plan=pro",
  },
  {
    id: "cta-pro-questions",
    title: "20 questions per day on Pro",
    description: "Active recall accelerates learning. Upgrade and stop hitting limits.",
    cta_text: "See Pro plan",
    cta_url: "/billing?plan=pro",
  },
  {
    id: "cta-adfree",
    title: "Go ad-free on Pro",
    description: "Zero distractions, full focus. Pro and Premium users see no banners.",
    cta_text: "Upgrade Now",
    cta_url: "/billing",
  },
  {
    id: "cta-annual",
    title: "Save 2 months with annual billing",
    description: "Annual Pro plan — pay for 10, get 12 months of unlimited access.",
    cta_text: "Switch to Annual",
    cta_url: "/billing?cycle=yearly",
  },
];

const SIDEBAR_ADS: Ad[] = [
  {
    id: "cta-pro-sidebar",
    title: "Unlock Pro",
    description: "100 videos/month, offline access, and ad-free learning for NGN 2,999/mo.",
    cta_text: "Upgrade",
    cta_url: "/billing?plan=pro",
  },
  {
    id: "cta-premium-sidebar",
    title: "Go Premium",
    description: "Unlimited everything. Priority support. NGN 9,999/mo.",
    cta_text: "See Premium",
    cta_url: "/billing?plan=premium",
  },
];

const ROTATE_MS = 5 * 60 * 1000; // 5 minutes

interface AdBannerProps {
  placement?: "banner" | "sidebar";
  userPlan?: string;
  className?: string;
}

export default function AdBanner({ placement = "banner", userPlan, className = "" }: AdBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);

  const ads = placement === "sidebar" ? SIDEBAR_ADS : BANNER_ADS;

  // Rotate ad every 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [ads.length]);

  // Don't show to paid users
  const plan = (userPlan || "free").toLowerCase();
  if (plan === "pro" || plan === "premium" || dismissed) return null;

  const ad = ads[index % ads.length];

  if (placement === "sidebar") {
    return (
      <div className={`relative rounded-2xl border border-accent/20 bg-accent-muted p-5 ${className}`}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-accent-light" />
          <span className="text-xs font-semibold text-accent-light uppercase tracking-wide">Upgrade</span>
        </div>
        <p className="text-sm font-semibold text-white mb-1">{ad.title}</p>
        <p className="text-xs text-white/50 mb-4">{ad.description}</p>
        <button
          type="button"
          onClick={() => router.push(ad.cta_url)}
          className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
        >
          {ad.cta_text}
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  // Horizontal banner
  return (
    <div
      className={`relative flex items-center justify-between gap-4 rounded-xl border border-accent/20 bg-accent-muted px-5 py-3 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <TrendingUp size={18} className="text-accent-light shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-semibold text-white">{ad.title}</span>
          <span className="hidden sm:inline text-sm text-white/50"> — {ad.description}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => router.push(ad.cta_url)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
        >
          {ad.cta_text}
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
