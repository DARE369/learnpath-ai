// Orphaned by the ui-v2 Dashboard migration — re-homed on the Billing
// overview page, near the usage meters.
import React, { useState } from "react";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";
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
  videos: { singular: "video", plural: "videos", period: "this month" },
  hours: { singular: "hour", plural: "hours", period: "this month" },
  questions: { singular: "question", plural: "questions", period: "today" },
};

export default function UsageAlert({ data }: { data: UsageData }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const alert = pickHighestAlert(data);
  if (!alert) return null;

  const exceeded = alert.pct >= 100;
  const critical = !exceeded && alert.pct >= 95;
  const ml = METRIC_LABELS[alert.metric] ?? { singular: alert.metric, plural: `${alert.metric}s`, period: "this period" };
  const severe = exceeded || critical;

  let title: string;
  let body: string;
  if (exceeded) {
    title = `You've reached your ${ml.plural} limit`;
    body = `You've used all ${alert.limit} ${ml.plural} allowed ${ml.period}. Upgrade to continue.`;
  } else if (critical) {
    title = `Almost at your ${ml.plural} limit`;
    body = `Only ${alert.remaining} ${alert.remaining === 1 ? ml.singular : ml.plural} remaining ${ml.period}.`;
  } else {
    title = `Approaching your ${ml.plural} limit`;
    body = `You've used ${alert.pct.toFixed(0)}% of your ${ml.plural} ${ml.period}.`;
  }

  const tone = severe ? color.danger : color.warning;

  return (
    <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 12, borderRadius: 10, border: `1px solid ${severe ? "#E7B7AE" : "#F0D9AE"}`, background: tone.bg, padding: 16, marginBottom: 20 }}>
      <Icon name="alertCircle" size={18} className="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: tone.fg }}>{title}</div>
        <div style={{ fontSize: 12.5, color: color.inkSoft, marginTop: 2 }}>{body}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none", background: "#2B3A67", color: "#fff", fontSize: 12.5, fontWeight: 600, fontFamily: font.body, cursor: "pointer" }}
        >
          <Icon name="trendingUp" size={13} className="" /> Upgrade
        </button>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ padding: 4, borderRadius: 6, border: "none", background: "transparent", color: color.textFaint, cursor: "pointer", display: "flex" }}>
          <Icon name="close" size={14} className="" />
        </button>
      </div>
    </div>
  );
}
