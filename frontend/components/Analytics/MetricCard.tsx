import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  previous?: string | number;
  changePct?: number;   // positive = up, negative = down
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function MetricCard({
  label,
  value,
  icon,
  previous,
  changePct,
  prefix = "",
  suffix = "",
  className = "",
}: MetricCardProps) {
  const hasChange = changePct !== undefined && changePct !== null;
  const isUp = hasChange && changePct > 0;
  const isDown = hasChange && changePct < 0;
  const isFlat = hasChange && changePct === 0;

  const trendColor = isUp ? "text-success" : isDown ? "text-error" : "text-white/40";
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className={`bg-surface-elevated border border-border rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center text-accent-light">
          {icon}
        </div>
      </div>

      <p className="text-2xl font-bold text-white tabular-nums mb-1">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
      </p>

      {hasChange && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon size={12} />
          <span>{isUp ? "+" : ""}{changePct.toFixed(1)}% from last period</span>
        </div>
      )}

      {previous !== undefined && !hasChange && (
        <p className="text-xs text-white/30">
          Previous: {prefix}{typeof previous === "number" ? previous.toLocaleString() : previous}{suffix}
        </p>
      )}
    </div>
  );
}
