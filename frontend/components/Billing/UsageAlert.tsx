import React, { useState } from "react";
import { useRouter } from "next/router";
import { AlertCircle, X, TrendingUp } from "lucide-react";
import type { UsageData } from "./UsageCard";

const UNLIMITED = 999999;

interface AlertConfig {
  metric: string;
  pct: number;
  remaining: number;
  limit: number;
}

function pickHighestAlert(data: UsageData): AlertConfig | null {
  const candidates: AlertConfig[] = [];

  if (data.videos_limit < UNLIMITED && data.videos_percentage >= 80) {
    candidates.push({ metric: "videos", pct: data.videos_percentage, remaining: data.videos_remaining, limit: data.videos_limit });
  }
  if (data.hours_limit < UNLIMITED && data.hours_percentage >= 80) {
    candidates.push({ metric: "hours", pct: data.hours_percentage, remaining: data.hours_remaining, limit: data.hours_limit });
  }
  if (data.questions_day_limit < UNLIMITED && data.questions_percentage >= 80) {
    candidates.push({ metric: "questions", pct: data.questions_percentage, remaining: data.questions_remaining, limit: data.questions_day_limit });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.pct - a.pct)[0];
}

const METRIC_LABELS: Record<string, { singular: string; plural: string; period: string }> = {
  videos:    { singular: "video",    plural: "videos",    period: "this month" },
  hours:     { singular: "hour",     plural: "hours",     period: "this month" },
  questions: { singular: "question", plural: "questions", period: "today" },
};

interface UsageAlertProps {
  data: UsageData;
  className?: string;
}

export default function UsageAlert({ data, className = "" }: UsageAlertProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const alert = pickHighestAlert(data);
  if (!alert) return null;

  const exceeded = alert.pct >= 100;
  const critical = !exceeded && alert.pct >= 95;
  const ml = METRIC_LABELS[alert.metric] ?? { singular: alert.metric, plural: `${alert.metric}s`, period: "this period" };

  const borderColor = exceeded || critical ? "border-error/30 bg-error-muted" : "border-warning/30 bg-warning/10";
  const iconColor   = exceeded || critical ? "text-error" : "text-warning";

  let title: string;
  let body: string;
  if (exceeded) {
    title = `You've reached your ${ml.plural} limit`;
    body  = `You've used all ${alert.limit} ${ml.plural} allowed ${ml.period}. Upgrade to continue.`;
  } else if (critical) {
    title = `Almost at your ${ml.plural} limit`;
    body  = `Only ${alert.remaining} ${alert.remaining === 1 ? ml.singular : ml.plural} remaining ${ml.period}.`;
  } else {
    title = `Approaching your ${ml.plural} limit`;
    body  = `You've used ${alert.pct.toFixed(0)}% of your ${ml.plural} ${ml.period}.`;
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${borderColor} ${className}`}
      role="alert"
    >
      <AlertCircle size={18} className={`${iconColor} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${iconColor}`}>{title}</p>
        <p className="text-xs text-white/60 mt-0.5">{body}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-accent text-white text-xs font-semibold shadow-glow-sm hover:opacity-90 transition-opacity"
        >
          <TrendingUp size={13} />
          Upgrade
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
