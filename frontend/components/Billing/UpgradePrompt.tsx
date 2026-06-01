/**
 * Contextual upgrade prompt (Packet 4.3).
 *
 * Renders as an inline card or an overlay modal depending on `variant`.
 * Uses sessionStorage to prevent re-showing the same context more than once
 * per session. Does nothing for paid users.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Lock, AlertCircle, TrendingUp, Check, X } from "lucide-react";

export type PromptContext =
  | "feature_locked"
  | "video_limit_reached"
  | "approaching_limit"
  | "question_limit"
  | "search_limit"
  | "general";

interface Prompt {
  title: string;
  message: string;
  icon: React.ReactNode;
  highlights: string[];
  cta_text: string;
  cta_url: string;
}

const PRO_HIGHLIGHTS = [
  "100 videos per month",
  "20 questions per day",
  "Offline access",
  "Ad-free experience",
];

const PROMPTS: Record<PromptContext, Prompt> = {
  feature_locked: {
    title: "This feature requires Pro",
    message: "Upgrade to unlock offline access, advanced questions, and more.",
    icon: <Lock size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "Upgrade to Pro — NGN 2,999/mo",
    cta_url: "/billing?plan=pro",
  },
  video_limit_reached: {
    title: "You've watched all your free videos",
    message: "Upgrade to Pro for 100 videos per month, or wait until next month's reset.",
    icon: <AlertCircle size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "Upgrade to Pro",
    cta_url: "/billing?plan=pro",
  },
  approaching_limit: {
    title: "Running low on videos",
    message: "You're close to your monthly video limit. Upgrade to keep learning without interruption.",
    icon: <AlertCircle size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "Upgrade to Pro",
    cta_url: "/billing?plan=pro",
  },
  question_limit: {
    title: "Daily question limit reached",
    message: "Upgrade to Pro for 20 active-recall questions per day.",
    icon: <AlertCircle size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "Upgrade to Pro",
    cta_url: "/billing?plan=pro",
  },
  search_limit: {
    title: "Search limit reached for this hour",
    message: "Free accounts can search 2 times per hour. Pro unlocks 10 searches per hour.",
    icon: <AlertCircle size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "Upgrade to Pro",
    cta_url: "/billing?plan=pro",
  },
  general: {
    title: "Get more from LearnPath AI",
    message: "Unlock 100 videos per month, offline access, and an ad-free experience.",
    icon: <TrendingUp size={20} />,
    highlights: PRO_HIGHLIGHTS,
    cta_text: "See plans",
    cta_url: "/billing",
  },
};

const STORAGE_KEY = (ctx: string) => `lp:prompt_dismissed:${ctx}`;

interface UpgradePromptProps {
  context: PromptContext;
  userPlan?: string;
  variant?: "inline" | "modal";
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

export default function UpgradePrompt({
  context,
  userPlan,
  variant = "inline",
  open = true,
  onClose,
  className = "",
}: UpgradePromptProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // Restore dismissed state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY(context))) {
      setDismissed(true);
    }
  }, [context]);

  const plan = (userPlan || "free").toLowerCase();
  if (plan === "pro" || plan === "premium") return null;
  if (!open || dismissed) return null;

  const prompt = PROMPTS[context] ?? PROMPTS.general;

  function handleDismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY(context), "1");
    }
    setDismissed(true);
    onClose?.();
  }

  function handleUpgrade() {
    router.push(prompt.cta_url);
  }

  const inner = (
    <div className={`bg-surface-elevated border border-border rounded-2xl p-6 ${variant === "modal" ? "" : className}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent-light shrink-0">
            {prompt.icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{prompt.title}</h3>
            <p className="text-sm text-white/50 mt-0.5">{prompt.message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="space-y-1.5 mb-5">
        {prompt.highlights.map((h) => (
          <li key={h} className="flex items-center gap-2 text-sm text-white/60">
            <Check size={14} className="text-success shrink-0" />
            {h}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleUpgrade}
          className="flex-1 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
        >
          {prompt.cta_text}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-4 py-2.5 rounded-xl bg-surface-hover text-white/50 text-sm font-medium hover:text-white/80 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md animate-slide-up">{inner}</div>
      </div>
    );
  }

  return inner;
}
