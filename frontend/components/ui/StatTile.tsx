import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "./cn";
import { Card } from "./Card";

type Color = "accent" | "success" | "warning" | "info";

const ICON_BG: Record<Color, string> = {
  accent: "bg-accent-muted text-accent-light",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  info: "bg-info-muted text-info",
};

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color?: Color;
  trend?: "up" | "down" | "flat";
  delta?: string;
}

export function StatTile({ icon, label, value, color = "accent", trend, delta }: StatTileProps) {
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-error" : "text-white/40";
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", ICON_BG[color])}>{icon}</div>
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {delta}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{label}</p>
    </Card>
  );
}
