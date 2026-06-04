import React from "react";
import { cn } from "./cn";

type Color = "accent" | "success" | "warning" | "error";

const FILL: Record<Color, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

interface ProgressBarProps {
  value: number; // 0–100
  color?: Color;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, color = "accent", size = "md", className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-white/8", size === "sm" ? "h-1" : "h-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-all duration-500", FILL[color])} style={{ width: `${pct}%` }} />
    </div>
  );
}
