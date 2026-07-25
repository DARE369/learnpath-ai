"use client";
import React from "react";
import { Card, Button, ThresholdRing } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

interface FeedbackCardProps {
  score: number;
  isCorrect: boolean;
  explanation: string;
  feedback: string;
  keyInsight: string;
  onContinue: () => void;
}

const TIER_CONFIG = {
  correct: { label: "Great answer!", fg: color.success.fg, bg: color.success.bg, icon: "checkCircle" as const },
  partial: { label: "Almost there!", fg: color.warning.fg, bg: color.warning.bg, icon: "alertCircle" as const },
  incorrect: { label: "Keep going!", fg: color.danger.fg, bg: color.danger.bg, icon: "xCircle" as const },
};

export default function FeedbackCard({ score, explanation, feedback, keyInsight, onContinue }: FeedbackCardProps) {
  const tier = score >= 80 ? "correct" : score >= 51 ? "partial" : "incorrect";
  const cfg = TIER_CONFIG[tier];

  return (
    <Card dark padding="sm" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 22, borderBottom: `1px solid ${color.chromeBorder}` }}>
        <ThresholdRing pct={score} size={92} dark />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: cfg.bg, color: cfg.fg, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
            <Icon name={cfg.icon} size={16} className="" /> {cfg.label}
          </div>
          <p style={{ fontSize: 13.5, color: color.chromeTextMuted, lineHeight: 1.55, margin: 0 }}>{explanation}</p>
        </div>
      </div>

      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        {feedback && <p style={{ fontSize: 13.5, color: color.chromeTextMuted, lineHeight: 1.55, margin: 0 }}>{feedback}</p>}

        {keyInsight && (
          <div style={{ display: "flex", gap: 12, padding: 14, borderRadius: 10, background: "rgba(43,95,168,0.12)", border: "1px solid rgba(43,95,168,0.3)" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(43,95,168,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <Icon name="sparkles" size={12} className="" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6FA0E0", marginBottom: 2 }}>Key insight</div>
              <p style={{ fontSize: 13.5, color: color.chromeTextMuted, lineHeight: 1.55, margin: 0 }}>{keyInsight}</p>
            </div>
          </div>
        )}

        <Button onClick={onContinue} fullWidth style={{ fontFamily: font.body }}>
          Continue <Icon name="chevronRight" size={16} className="" />
        </Button>
      </div>
    </Card>
  );
}
